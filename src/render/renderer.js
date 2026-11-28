import { BUILDING_DEFINITIONS, RESOURCE_NODE_DEFINITIONS } from "../simulation/economy.js";
import { PALETTE, drawStructure, drawResourceNode } from "./sprites.js";

const TILE_SIZE = 28;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const EDGE_MARGIN = 96; // 平移時至少留這麼多像素的地圖在畫面內
const COLORS = {
  background: "#101614", grid: "rgba(190, 200, 192, 0.12)",
  plain: "#2b3431", rough: "#363d39", water: "#1b3438"
};
const DEFAULT_QUALITY = { maxPixelRatio: 1, resolution: 1, shadows: true, terrainTexture: false, paths: true, details: true };

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let pixelRatio = 1;
  let cssWidth = 0;
  let cssHeight = 0;
  let quality = { ...DEFAULT_QUALITY };
  const camera = { x: 0, y: 0, zoom: 1, initialized: false };
  let selectionRect = null;
  let hoverCell = null;
  let buildPreview = null;
  let terrainCache = null;
  let terrainKey = "";
  let dirty = true;

  const invalidate = () => { dirty = true; };
  const consumeDirty = () => { const was = dirty; dirty = false; return was; };

  function setQuality(next) {
    quality = { ...DEFAULT_QUALITY, ...next };
    terrainCache = null; // 紋理設定變動時重建地形快取
    invalidate();
  }

  /** 依 CSS 尺寸與像素比重設畫布；尺寸沒變就不動，避免清空畫布。 */
  function resize(ratio) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.max(1, Math.floor(width * ratio));
    const pixelHeight = Math.max(1, Math.floor(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || ratio !== pixelRatio) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    pixelRatio = ratio;
    if (camera.initialized && (width !== cssWidth || height !== cssHeight)) {
      // 版面改變（旋轉螢幕、開關抽屜）時維持畫面中心對應的地圖位置。
      const centerX = (cssWidth / 2 - camera.x) / camera.zoom;
      const centerY = (cssHeight / 2 - camera.y) / camera.zoom;
      camera.x = width / 2 - centerX * camera.zoom;
      camera.y = height / 2 - centerY * camera.zoom;
    }
    cssWidth = width;
    cssHeight = height;
    clampCamera(currentMap);
    invalidate();
  }

  let currentMap = { width: 48, height: 32 };

  const tileSize = () => TILE_SIZE * camera.zoom;

  function fitToView(world) {
    const fit = Math.min(cssWidth / (world.width * TILE_SIZE), cssHeight / (world.height * TILE_SIZE));
    camera.zoom = Math.max(MIN_ZOOM, Math.min(1.25, fit * 0.96));
    centerOn(world.width / 2, world.height / 2);
    camera.initialized = true;
  }

  function focusOn(cellX, cellY, zoom) {
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    camera.initialized = true;
    centerOn(cellX, cellY);
  }

  function centerOn(cellX, cellY) {
    camera.x = cssWidth / 2 - cellX * tileSize();
    camera.y = cssHeight / 2 - cellY * tileSize();
    clampCamera(currentMap);
    invalidate();
  }

  function clampCamera(map) {
    const tile = tileSize();
    const mapW = map.width * tile;
    const mapH = map.height * tile;
    camera.x = Math.min(cssWidth - Math.min(EDGE_MARGIN, mapW), Math.max(Math.min(EDGE_MARGIN, mapW) - mapW, camera.x));
    camera.y = Math.min(cssHeight - Math.min(EDGE_MARGIN, mapH), Math.max(Math.min(EDGE_MARGIN, mapH) - mapH, camera.y));
  }

  /** 整張地形只畫一次到離屏畫布，之後每幀只做一次 drawImage。 */
  function ensureTerrain(world) {
    const scale = quality.terrainTexture ? 2 : 1;
    const key = `${world.width}x${world.height}@${scale}`;
    if (terrainCache && terrainKey === key) return;
    const size = TILE_SIZE * scale;
    const layer = document.createElement("canvas");
    layer.width = world.width * size;
    layer.height = world.height * size;
    const lctx = layer.getContext("2d");
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const terrain = world.cells[y][x].terrain;
        const px = x * size;
        const py = y * size;
        lctx.fillStyle = terrain === "water" ? COLORS.water : terrain === "rough" ? COLORS.rough : COLORS.plain;
        lctx.fillRect(px, py, size, size);
        if (!quality.terrainTexture) continue;
        if (terrain === "plain") {
          lctx.fillStyle = "rgba(205, 192, 164, 0.035)";
          lctx.fillRect(px + size * 0.12, py + size * 0.12, size * 0.76, size * 0.76);
        } else if (terrain === "rough") {
          lctx.strokeStyle = "rgba(8, 12, 14, 0.28)";
          lctx.lineWidth = Math.max(1, size * 0.035);
          lctx.beginPath();
          for (let i = 0; i < 3; i++) {
            lctx.moveTo(px + size * (0.15 + i * 0.25), py + size * 0.78);
            lctx.lineTo(px + size * (0.45 + i * 0.25), py + size * 0.22);
          }
          lctx.stroke();
        } else {
          lctx.strokeStyle = "rgba(150, 200, 210, 0.16)";
          lctx.lineWidth = Math.max(1, size * 0.03);
          lctx.beginPath();
          lctx.moveTo(px + size * 0.2, py + size * 0.4); lctx.lineTo(px + size * 0.8, py + size * 0.4);
          lctx.moveTo(px + size * 0.3, py + size * 0.64); lctx.lineTo(px + size * 0.7, py + size * 0.64);
          lctx.stroke();
        }
      }
    }
    terrainCache = layer;
    terrainKey = key;
  }

  function draw(world) {
    currentMap = world;
    if (!camera.initialized) fitToView(world);
    ensureTerrain(world);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const tile = tileSize();
    const minX = Math.max(0, Math.floor(-camera.x / tile));
    const minY = Math.max(0, Math.floor(-camera.y / tile));
    const maxX = Math.min(world.width, Math.ceil((cssWidth - camera.x) / tile));
    const maxY = Math.min(world.height, Math.ceil((cssHeight - camera.y) / tile));
    if (maxX <= minX || maxY <= minY) return;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainCache, camera.x, camera.y, world.width * tile, world.height * tile);

    ctx.fillStyle = "rgba(96, 188, 150, 0.13)";
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (world.cells[y][x].owner === "player") ctx.fillRect(camera.x + x * tile, camera.y + y * tile, tile, tile);
      }
    }

    if (tile >= 12) drawGrid(minX, minY, maxX, maxY, tile);

    const visible = (x, y) => x >= minX - 1 && x <= maxX && y >= minY - 1 && y <= maxY;
    const geometryOf = (x, y) => ({ cx: camera.x + (x + 0.5) * tile, cy: camera.y + (y + 0.5) * tile, tile });
    const showLabel = quality.details && camera.zoom >= 0.85;

    for (const node of world.resourceNodes) {
      if (visible(node.x, node.y)) drawResourceNode(ctx, node, RESOURCE_NODE_DEFINITIONS[node.type], geometryOf(node.x, node.y), quality, showLabel);
    }
    for (const structure of world.structures) {
      if (!visible(structure.x, structure.y)) continue;
      const definition = BUILDING_DEFINITIONS[structure.type];
      const ownerColor = structure.owner === "player" ? (definition?.color || PALETTE.player)
        : structure.owner === "enemy" ? PALETTE.enemy : PALETTE.neutral;
      drawStructure(ctx, structure, geometryOf(structure.x, structure.y), ownerColor, world.selectedBuildingId === structure.id, quality);
    }
    drawStationRange(world, tile);
    const selected = new Set(world.selectedUnitIds);
    for (const unit of world.units) {
      if (visible(unit.x, unit.y)) drawUnit(unit, tile, selected.has(unit.id));
    }
    if (hoverCell && !buildPreview && tile >= 12) drawCellOutline(hoverCell.x, hoverCell.y, tile, "rgba(255, 240, 196, .35)");
    if (buildPreview) drawBuildPreview(tile);
    if (selectionRect) {
      ctx.fillStyle = "rgba(238, 106, 44, .12)";
      ctx.strokeStyle = PALETTE.signal;
      ctx.lineWidth = 1;
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    }
  }

  // 所有格線合併成一條路徑，只描邊一次。
  function drawGrid(minX, minY, maxX, maxY, tile) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const left = camera.x + minX * tile;
    const right = camera.x + maxX * tile;
    const top = camera.y + minY * tile;
    const bottom = camera.y + maxY * tile;
    for (let x = minX; x <= maxX; x++) { const px = Math.round(camera.x + x * tile) + 0.5; ctx.moveTo(px, top); ctx.lineTo(px, bottom); }
    for (let y = minY; y <= maxY; y++) { const py = Math.round(camera.y + y * tile) + 0.5; ctx.moveTo(left, py); ctx.lineTo(right, py); }
    ctx.stroke();
  }

  // 選取攻擊站時顯示射程環。
  function drawStationRange(world, tile) {
    const building = world.structures.find(item => item.id === world.selectedBuildingId);
    const station = building && BUILDING_DEFINITIONS[building.type]?.station;
    if (!station) return;
    ctx.beginPath();
    ctx.arc(camera.x + (building.x + 0.5) * tile, camera.y + (building.y + 0.5) * tile, station.range * tile, 0, Math.PI * 2);
    ctx.fillStyle = building.ready ? "rgba(238, 106, 44, .08)" : "rgba(160, 160, 160, .06)";
    ctx.fill();
    ctx.setLineDash([tile * 0.25, tile * 0.18]);
    ctx.strokeStyle = building.ready ? "rgba(238, 130, 70, .75)" : "rgba(170, 170, 170, .5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCellOutline(x, y, tile, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(camera.x + x * tile + 1, camera.y + y * tile + 1, tile - 2, tile - 2);
  }

  function drawBuildPreview(tile) {
    const { x, y, valid, type } = buildPreview;
    ctx.fillStyle = valid ? "rgba(143, 227, 160, .28)" : "rgba(214, 90, 70, .32)";
    ctx.fillRect(camera.x + x * tile, camera.y + y * tile, tile, tile);
    drawCellOutline(x, y, tile, valid ? "#8fe3a0" : "#e0624a");
    if (BUILDING_DEFINITIONS[type]?.extractor?.kind === "deposit") {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(226, 181, 58, .55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(camera.x + (x + 0.5) * tile, camera.y + (y - 2.5) * tile);
      ctx.lineTo(camera.x + (x + 3.5) * tile, camera.y + (y + 0.5) * tile);
      ctx.lineTo(camera.x + (x + 0.5) * tile, camera.y + (y + 3.5) * tile);
      ctx.lineTo(camera.x + (x - 2.5) * tile, camera.y + (y + 0.5) * tile);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawUnit(unit, tile, selected) {
    const cx = camera.x + (unit.x + 0.5) * tile;
    const cy = camera.y + (unit.y + 0.5) * tile;
    if (selected && quality.paths && unit.path.length) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const point of unit.path) ctx.lineTo(camera.x + (point.x + 0.5) * tile, camera.y + (point.y + 0.5) * tile);
      ctx.strokeStyle = "rgba(238, 160, 100, .5)";
      ctx.lineWidth = Math.max(1, tile * 0.07);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, tile * (selected ? 0.34 : 0.27), 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.player;
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#ffffff" : "#3a2a12";
    ctx.stroke();
  }

  function screenToCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const tile = tileSize();
    return { x: Math.floor((clientX - rect.left - camera.x) / tile), y: Math.floor((clientY - rect.top - camera.y) / tile) };
  }

  function screenRectToCellBounds(rect) {
    const a = screenToCell(rect.left, rect.top);
    const b = screenToCell(rect.right, rect.bottom);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
  }

  function panBy(dx, dy) {
    camera.x += dx;
    camera.y += dy;
    clampCamera(currentMap);
    invalidate();
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const beforeX = (sx - camera.x) / camera.zoom;
    const beforeY = (sy - camera.y) / camera.zoom;
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
    camera.x = sx - beforeX * camera.zoom;
    camera.y = sy - beforeY * camera.zoom;
    clampCamera(currentMap);
    invalidate();
  }

  function zoomCenter(factor) {
    const rect = canvas.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  return {
    draw, resize, setQuality, invalidate, consumeDirty, screenToCell, screenRectToCellBounds,
    panBy, zoomAt, zoomCenter, centerOn, focusOn,
    fitToView: world => { fitToView(world); invalidate(); },
    setSelectionRect(rect) { selectionRect = rect; invalidate(); },
    clearSelectionRect() { if (selectionRect) { selectionRect = null; invalidate(); } },
    setHoverCell(cell) {
      if (hoverCell?.x === cell?.x && hoverCell?.y === cell?.y) return;
      hoverCell = cell; invalidate();
    },
    setBuildPreview(preview) { buildPreview = preview; invalidate(); },
    getZoom: () => camera.zoom,
    getPixelRatio: () => pixelRatio
  };
}
