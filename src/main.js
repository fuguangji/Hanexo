import {
  createWorld, advanceWorld, issueMove, selectAt, selectUnitsInRect, buildAt, checkBuild,
  getWorldStats, getHQ, getBuildingDefinitions, getResourceDefinitions
} from "./simulation/world.js";
import { createRenderer } from "./render/renderer.js";
import { createInputController } from "./input/controller.js";
import { createInspector } from "./ui/inspector.js";
import { createSettingsDialog } from "./ui/settings-dialog.js";
import { el, formatAmount, formatTime } from "./ui/dom.js";
import { buildAccountUrl, connectAccount, describeAccount } from "./account/account.js";
import {
  LEVELS, PRESETS, loadSettings, saveSettings, detectLevel, effectiveQuality, pixelRatioFor, createQualityGovernor
} from "./settings/graphics.js";

const FIXED_STEP_MS = 100;
const HUD_INTERVAL_MS = 400;
const IDLE_REDRAW_MS = 500;

const $ = selector => document.querySelector(selector);
const canvas = $("#game-canvas");
const homeScreen = $("#home-screen");
const gameScreen = $("#game-screen");
const message = $("#game-message");
const notice = $("#notice");
const pauseButton = $("#pause-button");
const clockState = $("#clock-state");
const moveModeButton = $("#move-mode");
const sidePanel = $("#side-panel");
const panelToggle = $("#panel-toggle");

// ---------- 狀態 ----------
let world = null;
let renderer = null;
let input = null;
let paused = false;
let speed = 1;
let buildMode = null;
let moveMode = false;
let hover = null;
let session = 0;
let lastFrame = 0;
let lastDraw = 0;
let accumulator = 0;
let hudAccumulator = 0;
let noticeTimer = 0;
let resourceSignature = "";
let fpsFrames = 0;
let fpsStamp = 0;
let measuredFps = 0;
let fpsAnimating = false;

// ---------- 畫質 ----------
let settings = loadSettings();
let autoLevel = detectLevel({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
const governor = createQualityGovernor({
  level: autoLevel,
  onChange: level => { autoLevel = level; applyQuality(); showNotice(`幀率偏低，已自動降為「${PRESETS[level].label}」畫質。`); }
});
let quality = effectiveQuality(settings, autoLevel);

function applyQuality() {
  quality = effectiveQuality(settings, autoLevel);
  if (renderer) { renderer.setQuality(quality); resizeCanvas(); }
  $("#fps-readout").hidden = !quality.showFps;
}

const settingsDialog = createSettingsDialog({
  dialog: $("#settings-dialog"),
  getSettings: () => settings,
  onChange: next => {
    settings = next;
    saveSettings(settings);
    if (settings.preset === "auto") { autoLevel = detectLevel(); governor.reset(autoLevel); }
    applyQuality();
  },
  getLive: () => ({
    levelLabel: settings.preset === "auto" ? `自動（${PRESETS[LEVELS.includes(quality.level) ? quality.level : "high"].label}）` : quality.level === "custom" ? "自訂" : PRESETS[quality.level].label,
    pixelRatio: pixelRatioFor(quality, window.devicePixelRatio || 1),
    fps: world ? measuredFps : 0
  })
});

// ---------- 帳號 ----------
const accountButton = $("#account-button");
const account = connectAccount({
  onChange: state => {
    const view = describeAccount(state);
    accountButton.textContent = view.label;
    accountButton.title = view.title;
    accountButton.disabled = view.busy;
    accountButton.dataset.signedIn = String(view.signedIn);
  }
});
accountButton.addEventListener("click", () => window.location.assign(buildAccountUrl(window.location.href)));
window.addEventListener("pagehide", () => account.stop());

// ---------- 通知與訊息 ----------
function showNotice(text) {
  notice.textContent = text;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("visible"), 2800);
}
function say(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}

// ---------- 檢視器 ----------
const inspector = createInspector({
  root: $("#inspector"),
  transferSection: $("#transfer-section"),
  transferForm: $("#transfer-form"),
  hint: $("#inspector-hint"),
  getWorld: () => world,
  notify: showNotice,
  onWorldChange: () => updateHud(true),
  isInspectorOpen: () => $("#inspector-panel").open,
  isLogisticsOpen: () => $("#logistics-panel").open
});

// ---------- 遊戲流程 ----------
function startPersonalGame() {
  session += 1;
  const id = session;
  world = createWorld();
  renderer = createRenderer(canvas);
  renderer.setQuality(quality);
  paused = false; speed = 1; buildMode = null; moveMode = false; hover = null;
  accumulator = hudAccumulator = lastFrame = lastDraw = 0;
  resourceSignature = "";
  input?.dispose();
  input = createInputController({
    canvas, getRenderer: () => renderer, isMoveMode: () => moveMode,
    handlers: {
      onTap: (x, y, additive) => handleTap(x, y, additive),
      onBoxSelect: (rect, additive) => handleBoxSelect(rect, additive),
      onCommand: (x, y) => handleCommand(x, y),
      onHover: (x, y) => handleHover(x, y),
      onViewChange: updateZoomReadout
    }
  });
  homeScreen.hidden = true;
  gameScreen.hidden = false;
  document.body.classList.add("in-game");
  resizeCanvas();
  setStartView();
  // 面板與工具列的版面在下一幀才會穩定，再校正一次起始視角。
  requestAnimationFrame(() => { if (renderer && id === session) { resizeCanvas(); setStartView(); updateZoomReadout(); } });
  updateControls();
  updateHud(true);
  inspector.refresh(true);
  say("選取單位，再以右鍵（觸控：長按）指定目的地。金屬礦點：M 普通金屬／R 稀有金屬。");
  requestAnimationFrame(timestamp => frame(timestamp, session));
}

// 寬螢幕直接顯示整張地圖；窄螢幕整張地圖會小到看不清單位，改為聚焦總部並放大。
function setStartView() {
  renderer.fitToView(world);
  if (renderer.getZoom() < 0.6) {
    const hq = getHQ(world);
    renderer.focusOn(hq.x + 4, hq.y, 0.75);
  }
}

function returnHome() {
  session += 1;
  input?.dispose();
  input = null;
  world = null; renderer = null; buildMode = null; moveMode = false;
  gameScreen.hidden = true;
  homeScreen.hidden = false;
  document.body.classList.remove("in-game");
  closeDrawer();
}

function resizeCanvas() {
  if (!renderer) return;
  renderer.resize(pixelRatioFor(quality, window.devicePixelRatio || 1));
}

function frame(timestamp, id) {
  if (id !== session || !world || !renderer) return;
  const delta = lastFrame ? Math.min(timestamp - lastFrame, 250) : 0;
  lastFrame = timestamp;

  if (!paused) {
    accumulator += delta * speed;
    while (accumulator >= FIXED_STEP_MS) {
      advanceWorld(world, FIXED_STEP_MS / 1000);
      accumulator -= FIXED_STEP_MS;
    }
  }

  const frameBudget = quality.fpsCap ? 1000 / quality.fpsCap - 1 : 0;
  const due = timestamp - lastDraw >= frameBudget;
  const animating = !paused && world.units.some(unit => unit.path.length);
  const idleDue = timestamp - lastDraw >= IDLE_REDRAW_MS;
  if (due && (renderer.consumeDirty() || animating || idleDue)) {
    if (lastDraw && animating) governor.sample(timestamp - lastDraw, quality.fpsCap);
    lastDraw = timestamp;
    renderer.draw(world);
    fpsFrames += 1;
    fpsAnimating = fpsAnimating || animating;
  }
  if (timestamp - fpsStamp >= 1000) {
    // 閒置時只做低頻重繪，此時的數字沒有意義，改顯示待機。
    measuredFps = fpsAnimating ? Math.round(fpsFrames * 1000 / Math.max(1, timestamp - fpsStamp)) : 0;
    fpsFrames = 0; fpsStamp = timestamp; fpsAnimating = false;
    if (quality.showFps) $("#fps-readout").textContent = measuredFps ? `${measuredFps} FPS` : "待機";
  }

  hudAccumulator += delta;
  if (hudAccumulator >= HUD_INTERVAL_MS) {
    hudAccumulator = 0;
    updateHud();
    inspector.refresh();
  }
  if (world.winner && !paused) {
    paused = true;
    updateControls();
    say("任務完成：敵方總指揮部已被佔領。", true);
    showNotice("任務完成！");
  }
  requestAnimationFrame(next => frame(next, id));
}

// ---------- 輸入意圖 ----------
function handleTap(clientX, clientY, additive) {
  if (buildMode) return placeBuilding(clientX, clientY);
  const cell = renderer.screenToCell(clientX, clientY);
  const selected = selectAt(world, cell.x, cell.y, additive);
  say(selected?.type === "unit" ? `已選取 ${selected.entity.name}。`
    : selected?.type === "building" ? `已選取 ${selected.entity.label}。` : "已取消選取。");
  renderer.invalidate();
  inspector.refresh(true);
}

function handleBoxSelect(rect, additive) {
  const count = selectUnitsInRect(world, renderer.screenRectToCellBounds(rect), additive);
  say(count ? `已框選 ${count} 支單位。` : "框選範圍內沒有我方單位。");
  renderer.invalidate();
  inspector.refresh(true);
}

function handleCommand(clientX, clientY) {
  if (!world || world.winner) return;
  if (buildMode) { placeBuilding(clientX, clientY); return; }
  if (!world.selectedUnitIds.length) { showNotice("請先選取單位。"); return; }
  const cell = renderer.screenToCell(clientX, clientY);
  const ok = issueMove(world, world.selectedUnitIds, cell.x, cell.y);
  say(ok ? `已向 ${world.selectedUnitIds.length} 支單位下達移動命令。` : "無法抵達該位置。");
  renderer.invalidate();
}

function handleHover(clientX, clientY) {
  if (!renderer) return;
  hover = clientX === null ? null : renderer.screenToCell(clientX, clientY);
  renderer.setHoverCell(hover);
  updateBuildPreview();
}

function placeBuilding(clientX, clientY) {
  const cell = renderer.screenToCell(clientX, clientY);
  const result = buildAt(world, buildMode, cell.x, cell.y);
  if (!result.ok) { showNotice(result.reason); return; }
  say(`${result.building.label} 已建造。`);
  setBuildMode(null);
  renderer.invalidate();
  updateHud(true);
  inspector.refresh(true);
}

function updateBuildPreview() {
  if (!renderer) return;
  if (!buildMode || !hover) { renderer.setBuildPreview(null); return; }
  renderer.setBuildPreview({ x: hover.x, y: hover.y, type: buildMode, valid: checkBuild(world, buildMode, hover.x, hover.y).ok });
}

function setBuildMode(type) {
  buildMode = buildMode === type ? null : type;
  if (buildMode) { moveMode = false; closeDrawerOnMobile(); say(`建造模式：${getBuildingDefinitions()[buildMode].label}。點擊地圖空地放置。`); }
  updateControls();
  updateBuildPreview();
}

// ---------- 介面更新 ----------
function updateControls() {
  pauseButton.textContent = paused ? "繼續" : "暫停";
  pauseButton.setAttribute("aria-pressed", String(paused));
  clockState.textContent = paused ? "已暫停" : "運行中";
  clockState.dataset.state = paused ? "paused" : "running";
  document.querySelectorAll("[data-speed]").forEach(button => {
    const active = Number(button.dataset.speed) === speed;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-build]").forEach(button => {
    button.classList.toggle("active", button.dataset.build === buildMode);
    button.setAttribute("aria-pressed", String(button.dataset.build === buildMode));
  });
  $("#cancel-build").hidden = !buildMode;
  $("#build-hint").textContent = buildMode
    ? `建造模式：${getBuildingDefinitions()[buildMode].label}。點擊地圖空地放置，按 Esc 取消。`
    : "採集建築可直接建在空白地塊；金屬礦場須靠近金屬礦點。";
  moveModeButton.classList.toggle("active", moveMode);
  moveModeButton.setAttribute("aria-pressed", String(moveMode));
  canvas.classList.toggle("building-cursor", Boolean(buildMode));
  canvas.classList.toggle("move-cursor", moveMode);
}

function updateZoomReadout() {
  if (renderer) $("#zoom-value").textContent = `${Math.round(renderer.getZoom() * 100)}%`;
}

function updateHud(force = false) {
  if (!world) return;
  const stats = getWorldStats(world);
  $("#time-value").textContent = formatTime(stats.elapsedSeconds);
  $("#unit-value").textContent = String(stats.playerUnits);
  $("#building-value").textContent = String(stats.buildings);
  $("#territory-value").textContent = String(stats.capturedCells);
  $("#strip-time").textContent = formatTime(stats.elapsedSeconds);
  updateZoomReadout();

  const entries = Object.entries(stats.hqInventory).filter(([, amount]) => amount > 0.001);
  const signature = entries.map(([key, amount]) => `${key}:${formatAmount(amount)}`).join("|");
  if (!force && signature === resourceSignature) return;
  resourceSignature = signature;
  const strip = $("#resource-strip");
  strip.replaceChildren();
  const definitions = getResourceDefinitions();
  for (const [resource, amount] of entries) {
    const chip = el("div", "resource-chip");
    const swatch = el("i", "swatch");
    swatch.style.background = definitions[resource]?.color || "#999";
    chip.append(swatch, el("span", "", definitions[resource]?.label || resource), el("strong", "", formatAmount(amount)));
    strip.append(chip);
  }
  if (!entries.length) strip.append(el("span", "muted-copy", "總部沒有庫存"));
}

// ---------- 行動版抽屜 ----------
const isMobileLayout = () => matchMedia("(max-width: 900px)").matches;
function setDrawer(open) {
  sidePanel.dataset.open = String(open);
  panelToggle.setAttribute("aria-expanded", String(open));
  panelToggle.querySelector(".drawer-label").textContent = open ? "收起面板" : "控制面板";
  requestAnimationFrame(resizeCanvas);
}
function closeDrawer() { setDrawer(false); }
function closeDrawerOnMobile() { if (isMobileLayout()) closeDrawer(); }
panelToggle.addEventListener("click", () => setDrawer(sidePanel.dataset.open !== "true"));

// ---------- 事件綁定 ----------
document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
  if (button.dataset.mode === "personal") startPersonalGame();
  else showNotice(button.dataset.mode === "server" ? "官方公服尚未開放。" : "私人聯機尚未開放。");
}));
document.querySelectorAll("[data-open-settings]").forEach(button => button.addEventListener("click", () => settingsDialog.open()));
$("#back-home").addEventListener("click", returnHome);
pauseButton.addEventListener("click", () => { paused = !paused; updateControls(); });
document.querySelectorAll("[data-speed]").forEach(button => button.addEventListener("click", () => { speed = Number(button.dataset.speed); updateControls(); }));
document.querySelectorAll("[data-build]").forEach(button => button.addEventListener("click", () => setBuildMode(button.dataset.build)));
$("#cancel-build").addEventListener("click", () => setBuildMode(null));
moveModeButton.addEventListener("click", () => {
  moveMode = !moveMode;
  if (moveMode) buildMode = null;
  updateControls(); updateBuildPreview();
  say(moveMode ? "移動模式：點擊地圖，已選取的單位會前往該處。" : "已回到選取模式。");
});
$("#zoom-in").addEventListener("click", () => { renderer?.zoomCenter(1.25); updateZoomReadout(); });
$("#zoom-out").addEventListener("click", () => { renderer?.zoomCenter(0.8); updateZoomReadout(); });
$("#view-fit").addEventListener("click", () => { if (renderer) { renderer.fitToView(world); updateZoomReadout(); } });
$("#view-hq").addEventListener("click", () => { const hq = getHQ(world); if (hq) renderer.centerOn(hq.x + 0.5, hq.y + 0.5); });
document.querySelectorAll(".panel-group").forEach(panel => panel.addEventListener("toggle", () => {
  if (panel.open && (panel.id === "inspector-panel" || panel.id === "logistics-panel")) inspector.refresh(true);
}));

const PAN_KEYS = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], KeyA: [1, 0], KeyD: [-1, 0], KeyW: [0, 1], KeyS: [0, -1] };
window.addEventListener("keydown", event => {
  if (!world || document.querySelector("dialog[open]")) return;
  if (event.target.matches?.("input, select, textarea")) return;
  const ctrl = event.ctrlKey || event.metaKey;
  if (event.code === "Space") { event.preventDefault(); paused = !paused; updateControls(); }
  else if (event.code === "Escape") { if (buildMode) setBuildMode(null); else if (moveMode) moveModeButton.click(); }
  else if (event.code === "KeyA" && ctrl) {
    event.preventDefault();
    world.selectedUnitIds = world.units.filter(unit => unit.owner === "player").map(unit => unit.id);
    world.selectedBuildingId = null;
    renderer.invalidate(); inspector.refresh(true);
  } else if (PAN_KEYS[event.code] && !ctrl) {
    event.preventDefault();
    const [dx, dy] = PAN_KEYS[event.code];
    renderer.panBy(dx * 56, dy * 56);
  } else if (event.key === "+" || event.key === "=") { renderer.zoomCenter(1.15); updateZoomReadout(); }
  else if (event.key === "-" || event.key === "_") { renderer.zoomCenter(0.87); updateZoomReadout(); }
  else if (event.code === "KeyH") $("#view-hq").click();
});

new ResizeObserver(() => resizeCanvas()).observe(canvas);
window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { lastFrame = 0; resizeCanvas(); } });
matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", event => {
  if (event.matches && settings.preset === "auto") { autoLevel = "low"; governor.reset("low"); applyQuality(); }
});
applyQuality();
