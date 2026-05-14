# Chart Drawing App

A full-stack freeform chart drawing application with a Python backend and plain HTML/CSS/JavaScript frontend.

## Features
- **Freeform drawing** with pencil, lines, rectangles, circles, and text
- **Color picker** with 8 preset colors
- **Adjustable brush size**
- **Save/Load charts** per user (localStorage-based user ID)
- **Thumbnail previews** in the chart sidebar
- **Delete and clear** functionality

## Architecture
- **Backend**: Python FastAPI + SQLite (SQLAlchemy ORM)
- **Frontend**: Vanilla HTML/CSS/JavaScript + [Fabric.js](http://fabricjs.com/) (loaded via CDN)

The backend serves the frontend as static files — no Node.js or build step required.

## Prerequisites
- **Python 3.10+**
- **pip** (Python package manager)

## Getting Started

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the server
```bash
python main.py
```
The server starts at `http://localhost:8000` and serves both the API and the frontend.

### 3. Open the app
Navigate to [http://localhost:8000](http://localhost:8000) in your browser.

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/charts?user_id=X` | List user's charts |
| POST | `/api/charts` | Create a new chart |
| GET | `/api/charts/{id}` | Get a chart by ID |
| PUT | `/api/charts/{id}` | Update a chart |
| DELETE | `/api/charts/{id}` | Delete a chart |
