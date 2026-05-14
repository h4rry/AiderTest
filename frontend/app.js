(function () {
  "use strict";

  const API = "/api/charts";
  const COLORS = ["#000000", "#ff0000", "#ff8800", "#ffff00", "#00cc00", "#0088ff", "#8800ff", "#ffffff"];

  // --- State ---
  let userId = localStorage.getItem("chart_user_id");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("chart_user_id", userId);
  }

  let fc = null; // fabric.Canvas
  let activeChartId = null;
  let currentTool = "pencil";
  let currentColor = COLORS[0];
  let brushSize = 3;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let activeShape = null;

  // --- API helpers ---
  async function apiListCharts() {
    const res = await fetch(API + "?user_id=" + encodeURIComponent(userId));
    if (!res.ok) throw new Error("Failed to list charts");
    return res.json();
  }

  async function apiCreateChart(data) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create chart");
    return res.json();
  }

  async function apiGetChart(id) {
    const res = await fetch(API + "/" + id);
    if (!res.ok) throw new Error("Failed to get chart");
    return res.json();
  }

  async function apiUpdateChart(id, data) {
    const res = await fetch(API + "/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update chart");
    return res.json();
  }

  async function apiDeleteChart(id) {
    const res = await fetch(API + "/" + id, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete chart");
  }

  // --- Sidebar ---
  async function refreshChartList() {
    const listEl = document.getElementById("chart-list");
    try {
      const charts = await apiListCharts();
      if (charts.length === 0) {
        listEl.innerHTML = '<p class="no-charts">No saved charts yet</p>';
        return;
      }
      listEl.innerHTML = charts.map(function (c) {
        var cls = "chart-item" + (c.id === activeChartId ? " active" : "");
        var thumb = c.thumbnail
          ? '<img src="' + c.thumbnail + '" alt="' + c.title + '" />'
          : "";
        return (
          '<div class="' + cls + '" data-id="' + c.id + '">' +
          thumb +
          '<div class="chart-item-footer">' +
          "<span>" + c.title + "</span>" +
          '<button class="delete-btn" data-id="' + c.id + '">✕</button>' +
          "</div></div>"
        );
      }).join("");

      listEl.querySelectorAll(".chart-item").forEach(function (el) {
        el.addEventListener("click", function () {
          loadChart(el.dataset.id);
        });
      });

      listEl.querySelectorAll(".delete-btn").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteChart(btn.dataset.id);
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function saveChart() {
    if (!fc) return;
    var canvasData = JSON.stringify(fc.toJSON());
    var thumbnail = fc.toDataURL({ format: "png", multiplier: 0.25 });

    try {
      if (activeChartId) {
        await apiUpdateChart(activeChartId, { canvas_data: canvasData, thumbnail: thumbnail });
      } else {
        var chart = await apiCreateChart({
          user_id: userId,
          title: "Untitled Chart",
          canvas_data: canvasData,
          thumbnail: thumbnail,
        });
        activeChartId = chart.id;
      }
      await refreshChartList();
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChart(id) {
    if (!fc) return;
    try {
      var chart = await apiGetChart(id);
      fc.loadFromJSON(JSON.parse(chart.canvas_data), function () {
        fc.renderAll();
        activeChartId = id;
        refreshChartList();
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteChart(id) {
    try {
      await apiDeleteChart(id);
      if (activeChartId === id) {
        activeChartId = null;
        fc.clear();
        fc.backgroundColor = "#ffffff";
        fc.renderAll();
      }
      await refreshChartList();
    } catch (err) {
      console.error(err);
    }
  }

  function newChart() {
    activeChartId = null;
    fc.clear();
    fc.backgroundColor = "#ffffff";
    fc.renderAll();
    refreshChartList();
  }

  // --- Color palette ---
  function buildColorPalette() {
    var palette = document.getElementById("color-palette");
    COLORS.forEach(function (c) {
      var swatch = document.createElement("div");
      swatch.className = "color-swatch" + (c === currentColor ? " active" : "");
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.addEventListener("click", function () {
        currentColor = c;
        palette.querySelectorAll(".color-swatch").forEach(function (s) {
          s.classList.toggle("active", s.dataset.color === c);
        });
        applyTool();
      });
      palette.appendChild(swatch);
    });
  }

  // --- Tool selection ---
  function applyTool() {
    if (!fc) return;

    fc.off("mouse:down");
    fc.off("mouse:move");
    fc.off("mouse:up");
    fc.isDrawingMode = false;
    fc.selection = true;
    fc.defaultCursor = "default";

    if (currentTool === "pencil") {
      fc.isDrawingMode = true;
      fc.freeDrawingBrush.color = currentColor;
      fc.freeDrawingBrush.width = brushSize;
      return;
    }

    fc.defaultCursor = "crosshair";
    fc.selection = false;

    fc.on("mouse:down", function (opt) {
      if (currentTool === "text") {
        var pointer = fc.getPointer(opt.e);
        var text = new fabric.IText("Text", {
          left: pointer.x,
          top: pointer.y,
          fill: currentColor,
          fontSize: brushSize * 6,
          fontFamily: "sans-serif",
        });
        fc.add(text);
        fc.setActiveObject(text);
        text.enterEditing();
        return;
      }

      var pointer = fc.getPointer(opt.e);
      isDrawing = true;
      startX = pointer.x;
      startY = pointer.y;

      if (currentTool === "line") {
        activeShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: currentColor,
          strokeWidth: brushSize,
          selectable: false,
        });
      } else if (currentTool === "rect") {
        activeShape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          stroke: currentColor,
          strokeWidth: brushSize,
          fill: "transparent",
          selectable: false,
        });
      } else if (currentTool === "circle") {
        activeShape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          stroke: currentColor,
          strokeWidth: brushSize,
          fill: "transparent",
          selectable: false,
        });
      }

      if (activeShape) fc.add(activeShape);
    });

    fc.on("mouse:move", function (opt) {
      if (!isDrawing || !activeShape) return;
      var pointer = fc.getPointer(opt.e);

      if (currentTool === "line") {
        activeShape.set({ x2: pointer.x, y2: pointer.y });
      } else if (currentTool === "rect") {
        activeShape.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY),
        });
      } else if (currentTool === "circle") {
        activeShape.set({
          rx: Math.abs(pointer.x - startX) / 2,
          ry: Math.abs(pointer.y - startY) / 2,
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
        });
      }

      fc.renderAll();
    });

    fc.on("mouse:up", function () {
      if (activeShape) activeShape.set({ selectable: true });
      isDrawing = false;
      activeShape = null;
    });
  }

  // --- Canvas init ---
  function initCanvas() {
    var wrapper = document.getElementById("canvas-wrapper");
    fc = new fabric.Canvas("drawing-canvas", {
      width: wrapper.offsetWidth,
      height: wrapper.offsetHeight,
      backgroundColor: "#ffffff",
    });

    window.addEventListener("resize", function () {
      fc.setWidth(wrapper.offsetWidth);
      fc.setHeight(wrapper.offsetHeight);
      fc.renderAll();
    });

    applyTool();
  }

  // --- Wire up UI ---
  function init() {
    buildColorPalette();
    initCanvas();
    refreshChartList();

    document.getElementById("btn-new").addEventListener("click", newChart);
    document.getElementById("btn-save").addEventListener("click", saveChart);
    document.getElementById("btn-clear").addEventListener("click", function () {
      fc.clear();
      fc.backgroundColor = "#ffffff";
      fc.renderAll();
    });

    document.querySelectorAll(".tool-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentTool = btn.dataset.tool;
        document.querySelectorAll(".tool-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        applyTool();
      });
    });

    var sizeInput = document.getElementById("brush-size");
    var sizeLabel = document.getElementById("brush-size-label");
    sizeInput.addEventListener("input", function () {
      brushSize = Number(sizeInput.value);
      sizeLabel.textContent = brushSize;
      applyTool();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
