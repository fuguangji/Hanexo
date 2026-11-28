// 畫布輸入：滑鼠、觸控與筆共用一套邏輯，只回報「意圖」，不直接改動遊戲狀態。
//   滑鼠：左鍵選取／框選、右鍵下令、中鍵拖曳平移、滾輪縮放
//   觸控：單指拖曳平移、輕點選取、長按下令、雙指縮放並平移
const DRAG_THRESHOLD = 6;
const LONG_PRESS_MS = 450;

export function createInputController({ canvas, getRenderer, isMoveMode, handlers }) {
  const pointers = new Map();
  let gesture = null;
  let lastPointerType = "mouse";
  let longPressTimer = 0;

  const renderer = () => getRenderer();
  const clearLongPress = () => { clearTimeout(longPressTimer); longPressTimer = 0; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function onPointerDown(event) {
    if (!renderer()) return;
    lastPointerType = event.pointerType || "mouse";
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture?.(event.pointerId);

    if (event.pointerType === "mouse") {
      if (event.button === 1) {
        gesture = { type: "pan", lastX: event.clientX, lastY: event.clientY };
        event.preventDefault();
      } else if (event.button === 0) {
        gesture = { type: "select", startX: event.clientX, startY: event.clientY, moved: false };
      }
      return;
    }

    if (pointers.size === 1) {
      gesture = { type: "touch", startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, fired: false };
      clearLongPress();
      longPressTimer = setTimeout(() => {
        if (gesture?.type === "touch" && !gesture.moved) {
          gesture.fired = true;
          navigator.vibrate?.(12);
          handlers.onCommand(gesture.startX, gesture.startY);
        }
      }, LONG_PRESS_MS);
    } else if (pointers.size === 2) {
      clearLongPress();
      const [a, b] = [...pointers.values()];
      gesture = { type: "pinch", lastDistance: distance(a, b) || 1, lastCenter: midpoint(a, b) };
    }
  }

  function onPointerMove(event) {
    const r = renderer();
    if (!r) return;
    if (event.pointerType === "mouse") handlers.onHover(event.clientX, event.clientY);
    const tracked = pointers.get(event.pointerId);
    if (tracked) { tracked.x = event.clientX; tracked.y = event.clientY; }
    if (!gesture) return;

    if (gesture.type === "pan") {
      r.panBy(event.clientX - gesture.lastX, event.clientY - gesture.lastY);
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
    } else if (gesture.type === "select") {
      const dist = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      gesture.moved = gesture.moved || dist > DRAG_THRESHOLD;
      if (gesture.moved && !isMoveMode()) {
        const rect = canvas.getBoundingClientRect();
        r.setSelectionRect({
          x: Math.min(gesture.startX, event.clientX) - rect.left,
          y: Math.min(gesture.startY, event.clientY) - rect.top,
          width: Math.abs(event.clientX - gesture.startX),
          height: Math.abs(event.clientY - gesture.startY)
        });
      }
    } else if (gesture.type === "touch" && tracked) {
      if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > DRAG_THRESHOLD) {
        gesture.moved = true;
        clearLongPress();
      }
      if (gesture.moved) {
        r.panBy(event.clientX - gesture.lastX, event.clientY - gesture.lastY);
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
      }
    } else if (gesture.type === "pinch" && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = distance(a, b) || 1;
      const center = midpoint(a, b);
      r.panBy(center.x - gesture.lastCenter.x, center.y - gesture.lastCenter.y);
      r.zoomAt(center.x, center.y, dist / gesture.lastDistance);
      gesture.lastDistance = dist;
      gesture.lastCenter = center;
    }
  }

  function onPointerUp(event) {
    const r = renderer();
    pointers.delete(event.pointerId);
    clearLongPress();
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const current = gesture;
    if (!current || !r) { gesture = null; return; }

    if (current.type === "select") {
      gesture = null;
      r.clearSelectionRect();
      if (isMoveMode() && !current.moved) { handlers.onCommand(event.clientX, event.clientY); return; }
      if (current.moved && !isMoveMode()) {
        handlers.onBoxSelect({
          left: Math.min(current.startX, event.clientX), top: Math.min(current.startY, event.clientY),
          right: Math.max(current.startX, event.clientX), bottom: Math.max(current.startY, event.clientY)
        }, event.shiftKey);
      } else if (!current.moved) {
        handlers.onTap(event.clientX, event.clientY, event.shiftKey);
      }
    } else if (current.type === "touch") {
      gesture = null;
      if (!current.moved && !current.fired) {
        if (isMoveMode()) handlers.onCommand(current.startX, current.startY);
        else handlers.onTap(current.startX, current.startY, false);
      }
    } else if (current.type === "pinch") {
      // 剩一根手指時不要把它當成新的點擊或下令。
      gesture = pointers.size === 1 ? { type: "touch", startX: 0, startY: 0, lastX: [...pointers.values()][0].x, lastY: [...pointers.values()][0].y, moved: true, fired: true } : null;
    } else {
      gesture = null;
    }
  }

  function onPointerCancel(event) {
    pointers.delete(event.pointerId);
    clearLongPress();
    gesture = null;
    renderer()?.clearSelectionRect();
  }

  function onContextMenu(event) {
    event.preventDefault();
    // 觸控長按會由 timer 下令；這裡只處理滑鼠右鍵，避免重複下令。
    if (lastPointerType === "mouse") handlers.onCommand(event.clientX, event.clientY);
  }

  function onWheel(event) {
    if (!renderer()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1;
    const factor = Math.exp(-Math.max(-120, Math.min(120, event.deltaY * unit)) * 0.0016);
    renderer().zoomAt(event.clientX, event.clientY, factor);
    handlers.onViewChange?.();
  }

  function onPointerLeave(event) {
    if (event.pointerType === "mouse") handlers.onHover(null, null);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    dispose() {
      clearLongPress();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
    }
  };
}
