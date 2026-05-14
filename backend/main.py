import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ── Database setup ──────────────────────────────────────────────────────────

DATABASE_URL = "sqlite:///./charts.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class ChartModel(Base):
    __tablename__ = "charts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False, default="Untitled Chart")
    canvas_data = Column(Text, nullable=False)  # JSON string from Fabric.js
    thumbnail = Column(Text, nullable=True)      # base64 data-url
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(bind=engine)

# ── Pydantic schemas ───────────────────────────────────────────────────────


class ChartCreate(BaseModel):
    user_id: str
    title: str = "Untitled Chart"
    canvas_data: str
    thumbnail: Optional[str] = None


class ChartUpdate(BaseModel):
    title: Optional[str] = None
    canvas_data: Optional[str] = None
    thumbnail: Optional[str] = None


class ChartResponse(BaseModel):
    id: str
    user_id: str
    title: str
    canvas_data: str
    thumbnail: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChartSummary(BaseModel):
    id: str
    title: str
    thumbnail: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(title="Chart Drawing API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/api/charts", response_model=list[ChartSummary])
def list_charts(user_id: str = Query(...)):
    db: Session = next(get_db())
    charts = (
        db.query(ChartModel)
        .filter(ChartModel.user_id == user_id)
        .order_by(ChartModel.updated_at.desc())
        .all()
    )
    return charts


@app.post("/api/charts", response_model=ChartResponse, status_code=201)
def create_chart(chart: ChartCreate):
    db: Session = next(get_db())
    db_chart = ChartModel(
        id=str(uuid.uuid4()),
        user_id=chart.user_id,
        title=chart.title,
        canvas_data=chart.canvas_data,
        thumbnail=chart.thumbnail,
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    return db_chart


@app.get("/api/charts/{chart_id}", response_model=ChartResponse)
def get_chart(chart_id: str):
    db: Session = next(get_db())
    chart = db.query(ChartModel).filter(ChartModel.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart


@app.put("/api/charts/{chart_id}", response_model=ChartResponse)
def update_chart(chart_id: str, updates: ChartUpdate):
    db: Session = next(get_db())
    chart = db.query(ChartModel).filter(ChartModel.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    if updates.title is not None:
        chart.title = updates.title
    if updates.canvas_data is not None:
        chart.canvas_data = updates.canvas_data
    if updates.thumbnail is not None:
        chart.thumbnail = updates.thumbnail
    chart.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(chart)
    return chart


@app.delete("/api/charts/{chart_id}", status_code=204)
def delete_chart(chart_id: str):
    db: Session = next(get_db())
    chart = db.query(ChartModel).filter(ChartModel.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    db.delete(chart)
    db.commit()
    return None


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
