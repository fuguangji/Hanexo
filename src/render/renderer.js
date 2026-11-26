import { BUILDING_DEFINITIONS, RESOURCE_NODE_DEFINITIONS } from "../simulation/economy.js";

const TILE_SIZE = 28;
const COLORS = {
  background: "#10171b", grid: "rgba(185, 194, 193, 0.13)",
  plain: "#293238", rough: "#353b3d", water: "#1b3440",
  player: "#e5b45f", enemy: "#c86f5b", neutral: "#a8a49a", text: "#e8e5dc"
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let pixelRatio = 1;
  let camera = { x: 0, y: 0, zoom: 1, initialized: false };
  let selectionRect = null;

  function setPixelRatio(value) { pixelRatio = value; }

  function draw(world) {
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    if (!camera.initialized) centerCamera(world, width, height);
    const tile = TILE_SIZE * camera.zoom;
    const minX = Math.max(0, Math.floor(-camera.x / tile));
    const minY = Math.max(0, Math.floor(-camera.y / tile));
    const maxX = Math.min(world.width, Math.ceil((width - camera.x) / tile));
    const maxY = Math.min(world.height, Math.ceil((height - camera.y) / tile));

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const cell = world.cells[y][x];
        const sx = camera.x + x * tile;
        const sy = camera.y + y * tile;
        ctx.fillStyle = cell.terrain === "water" ? COLORS.water : cell.terrain === "rough" ? COLORS.rough : COLORS.plain;
        ctx.fillRect(sx, sy, tile, tile);
        if (cell.terrain === "plain") {
          ctx.fillStyle = "rgba(205, 192, 164, 0.035)";
          ctx.fillRect(sx + tile * 0.12, sy + tile * 0.12, tile * 0.76, tile * 0.76);
        } else if (cell.terrain === "rough") {
          ctx.strokeStyle = "rgba(8, 12, 14, 0.22)";
          ctx.lineWidth = Math.max(1, tile * 0.035);
          ctx.beginPath(); ctx.moveTo(sx + tile * 0.18, sy + tile * 0.72); ctx.lineTo(sx + tile * 0.76, sy + tile * 0.24); ctx.stroke();
        }
        if (cell.owner === "player") {
          ctx.fillStyle = "rgba(88, 190, 222, 0.16)";
          ctx.fillRect(sx, sy, tile, tile);
        }
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, tile, tile);
      }
    }
    for (const node of world.resourceNodes) drawResourceNode(node, tile);
    for (const structure of world.structures) drawStructure(structure, tile, world.selectedBuildingId === structure.id);
    for (const unit of world.units) drawUnit(unit, tile, world.selectedUnitIds.includes(unit.id));
    if (selectionRect) {
      ctx.fillStyle = "rgba(128,216,242,.12)";
      ctx.strokeStyle = COLORS.player;
      ctx.lineWidth = 1;
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    }
  }

  function centerCamera(world, width, height) {
    const mapWidth = world.width * TILE_SIZE;
    const mapHeight = world.height * TILE_SIZE;
    camera.x = (width - mapWidth) / 2;
    camera.y = (height - mapHeight) / 2;
    camera.initialized = true;
  }

  function drawResourceNode(node, tile) {
    const definition = RESOURCE_NODE_DEFINITIONS[node.type];
    const cx = camera.x + (node.x + 0.5) * tile;
    const cy = camera.y + (node.y + 0.5) * tile;
    const radius = Math.max(5, tile * 0.34);
    ctx.globalAlpha = Math.max(0.35, node.amount / node.maxAmount);
    ctx.fillStyle = "#171d20";
    ctx.fillRect(cx - radius * 1.2, cy - radius * 0.8, radius * 2.4, radius * 1.6);
    ctx.strokeStyle = definition.color;
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.strokeRect(cx - radius * 1.2, cy - radius * 0.8, radius * 2.4, radius * 1.6);
    ctx.fillStyle = definition.color;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.72 + i * radius * 0.62, cy + radius * 0.35);
      ctx.lineTo(cx - radius * 0.45 + i * radius * 0.62, cy - radius * 0.35);
      ctx.lineTo(cx - radius * 0.12 + i * radius * 0.62, cy + radius * 0.35);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (camera.zoom >= 0.85) {
      ctx.fillStyle = "#171d20";
      ctx.font = `900 ${Math.max(8, tile * 0.32)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(node.resource === "commonMetal" ? "M" : "R", cx, cy);
    }
  }

  function drawStructure(structure, tile, selected) {
    const cx = camera.x + (structure.x + 0.5) * tile;
    const cy = camera.y + (structure.y + 0.5) * tile;
    const definition = BUILDING_DEFINITIONS[structure.type];
    const color = structure.owner === "player" ? (definition?.color || COLORS.player) : structure.owner === "enemy" ? COLORS.enemy : COLORS.neutral;
    const size = tile * (structure.type === "hq" ? 0.76 : 0.66);
    ctx.fillStyle = color;
    ctx.strokeStyle = selected ? "#fff1c8" : "#101619";
    ctx.lineWidth = selected ? 3 : 1.5;
    if (structure.type === "outpost") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.65);
      ctx.lineTo(cx + size * 0.65, cy);
      ctx.lineTo(cx, cy + size * 0.65);
      ctx.lineTo(cx - size * 0.65, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      ctx.fillStyle = "#171d20";
      ctx.font = `bold ${Math.max(8, tile * 0.36)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const symbol = structure.type === "hq" ? "HQ" : structure.type === "factory" ? "F" : structure.type === "warehouse" ? "W" : structure.type === "metalMine" ? "M" : structure.type === "oilWell" ? "O" : structure.type === "lumberCamp" ? "L" : "Q";
      ctx.fillText(symbol, cx, cy);
    }
    if (selected) {
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.48, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawUnit(unit, tile, selected) {
    const cx = camera.x + (unit.x + 0.5) * tile;
    const cy = camera.y + (unit.y + 0.5) * tile;
    if (unit.path.length) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const point of unit.path) ctx.lineTo(camera.x + (point.x + 0.5) * tile, camera.y + (point.y + 0.5) * tile);
      ctx.strokeStyle = "rgba(131,217,243,.38)";
      ctx.lineWidth = Math.max(1, tile * 0.07);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, tile * (selected ? 0.34 : 0.27), 0, Math.PI * 2);
    ctx.fillStyle = COLORS.player;
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#ffffff" : "#173b4b";
    ctx.stroke();
  }

  function screenToCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - camera.x) / (TILE_SIZE * camera.zoom)),
      y: Math.floor((clientY - rect.top - camera.y) / (TILE_SIZE * camera.zoom))
    };
  }

  function screenRectToCellBounds(rect) {
    const a = screenToCell(rect.left, rect.top);
    const b = screenToCell(rect.right, rect.bottom);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
  }

  function panBy(dx, dy) {
    camera.x += dx;
    camera.y += dy;
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const beforeX = (sx - camera.x) / camera.zoom;
    const beforeY = (sy - camera.y) / camera.zoom;
    camera.zoom = Math.max(0.55, Math.min(2.1, camera.zoom * factor));
    camera.x = sx - beforeX * camera.zoom;
    camera.y = sy - beforeY * camera.zoom;
  }

  function setSelectionRect(rect) { selectionRect = rect; }
  function clearSelectionRect() { selectionRect = null; }
  function getZoom() { return camera.zoom; }

  return { draw, setPixelRatio, screenToCell, screenRectToCellBounds, panBy, zoomAt, setSelectionRect, clearSelectionRect, getZoom };
}
