import {
  createWorld, advanceWorld, issueMove, selectAt, selectUnitsInRect, buildAt,
  addProductionJob, removeProductionJob, adjustProductionAllocation,
  createTransferOrder, getWorldStats, getSelectedEntities,
  getBuildingDefinitions, getRecipeDefinitions, getResourceDefinitions
} from "./simulation/world.js";
import { createRenderer } from "./render/renderer.js";

const homeScreen = document.querySelector("#home-screen");
const gameScreen = document.querySelector("#game-screen");
const canvas = document.querySelector("#game-canvas");
const notice = document.querySelector("#notice");
const pauseButton = document.querySelector("#pause-button");
const clockState = document.querySelector("#clock-state");
const speedButtons = [...document.querySelectorAll("[data-speed]")];
const message = document.querySelector("#game-message");
const inspector = document.querySelector("#inspector");
const transferSection = document.querySelector("#transfer-section");
const transferForm = document.querySelector("#transfer-form");
const buildHint = document.querySelector("#build-hint");
const cancelBuildButton = document.querySelector("#cancel-build");

let world = null;
let renderer = null;
let paused = false;
let speed = 1;
let lastFrame = 0;
let accumulator = 0;
let hudAccumulator = 0;
const FIXED_STEP_MS = 100;
let noticeTimer;
let gameSession = 0;
let buildMode = null;
let pointerAction = null;

const $ = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function showNotice(text) {
  notice.textContent = text;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("visible"), 2600);
}

function startPersonalGame() {
  gameSession += 1;
  world = createWorld();
  renderer = createRenderer(canvas);
  paused = false;
  speed = 1;
  accumulator = 0;
  hudAccumulator = 0;
  lastFrame = 0;
  buildMode = null;
  pointerAction = null;
  updateControls();
  homeScreen.hidden = true;
  gameScreen.hidden = false;
  resizeCanvas();
  renderInspector();
  requestAnimationFrame(timestamp => frame(timestamp, gameSession));
}

function returnHome() {
  gameSession += 1;
  gameScreen.hidden = true;
  homeScreen.hidden = false;
  world = null;
  renderer = null;
  buildMode = null;
}

function resizeCanvas() {
  if (!renderer) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  renderer.setPixelRatio(dpr);
}

function updateControls() {
  pauseButton.textContent = paused ? "繼續" : "暫停";
  clockState.textContent = paused ? "已暫停" : "運行中";
  clockState.classList.toggle("paused", paused);
  speedButtons.forEach(button => button.classList.toggle("active", Number(button.dataset.speed) === speed));
  document.querySelectorAll("[data-build]").forEach(button => button.classList.toggle("active", button.dataset.build === buildMode));
  cancelBuildButton.hidden = !buildMode;
  buildHint.textContent = buildMode
    ? `建造模式：${getBuildingDefinitions()[buildMode].label}。點擊地圖空地放置，按 Esc 取消。`
    : "採集建築可直接建在空白地塊；金屬礦場須靠近金屬礦點。";
  canvas.classList.toggle("building-cursor", Boolean(buildMode));
}

function updateHud() {
  const stats = getWorldStats(world);
  document.querySelector("#time-value").textContent = formatTime(stats.elapsedSeconds);
  document.querySelector("#unit-value").textContent = String(stats.playerUnits);
  document.querySelector("#building-value").textContent = String(stats.buildings);
  document.querySelector("#territory-value").textContent = String(stats.capturedCells);
  document.querySelector("#zoom-value").textContent = `${Math.round(renderer.getZoom() * 100)}%`;
  const resourceList = document.querySelector("#hq-resource-list");
  resourceList.replaceChildren();
  for (const [resource, amount] of Object.entries(stats.hqInventory)) {
    if (amount <= 0.001) continue;
    const row = $("div", "hq-resource");
    row.append($("span", "", getResourceDefinitions()[resource]?.label || resource));
    row.append($("strong", "", formatAmount(amount)));
    resourceList.append(row);
  }
  if (!resourceList.children.length) resourceList.append($("p", "muted-copy", "無資源"));
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function frame(timestamp, session) {
  if (session !== gameSession || !world || !renderer) return;
  if (!lastFrame) lastFrame = timestamp;
  const delta = Math.min(timestamp - lastFrame, 250);
  lastFrame = timestamp;
  if (!paused) {
    accumulator += delta * speed;
    while (accumulator >= FIXED_STEP_MS) {
      advanceWorld(world, FIXED_STEP_MS / 1000);
      accumulator -= FIXED_STEP_MS;
    }
  }
  renderer.draw(world);
  hudAccumulator += delta;
  if (hudAccumulator >= 400) {
    updateHud();
    const editingInspector = inspector.contains(document.activeElement) || transferSection.contains(document.activeElement);
    if (!editingInspector) renderInspector();
    hudAccumulator = 0;
  }
  if (world.winner && !paused) {
    paused = true;
    updateControls();
    message.textContent = "任務完成：敵方總指揮部已被佔領。";
    message.classList.add("success");
  }
  requestAnimationFrame(nextTimestamp => frame(nextTimestamp, session));
}

function renderInspector() {
  if (!world) return;
  inspector.replaceChildren();
  transferSection.hidden = true;
  const selected = getSelectedEntities(world);
  if (selected.units.length) {
    inspector.append($("p", "inspector-title", selected.units.length === 1 ? selected.units[0].name : `已選取 ${selected.units.length} 支單位`));
    const hp = selected.units.reduce((sum, unit) => sum + unit.hp, 0);
    const maxHp = selected.units.reduce((sum, unit) => sum + unit.maxHp, 0);
    inspector.append($("p", "muted-copy", `總生命值 ${hp} / ${maxHp}`));
    inspector.append($("p", "muted-copy", selected.units.some(unit => unit.state === "moving") ? "狀態：移動中" : "狀態：待命"));
    return;
  }
  const building = selected.building;
  if (!building) {
    inspector.append($("p", "muted-copy", "選取單位或建築以查看資訊。"));
    return;
  }
  inspector.append($("p", "inspector-title", building.label));
  inspector.append($("p", "muted-copy", `等級 ${building.level} · 品質 ${building.quality.toFixed(2)} · 庫存 ${Math.floor(inventoryTotal(building.inventory) + building.reservedIncoming)} / ${building.capacity}`));
  const inventoryTitle = $("p", "sub-label", "獨立庫存");
  inspector.append(inventoryTitle);
  const inventoryEntries = Object.entries(building.inventory).filter(([, amount]) => amount > 0.001);
  if (inventoryEntries.length) {
    for (const [resource, amount] of inventoryEntries) {
      const definition = getResourceDefinitions()[resource];
      inspector.append($("p", "inventory-line", `${definition?.label || resource}　${formatAmount(amount)}`));
    }
  } else {
    inspector.append($("p", "muted-copy", "目前沒有庫存。"));
  }
  if (["lumberCamp", "quarry", "oilWell", "metalMine"].includes(building.type)) {
    const extractionLabel = building.type === "metalMine" ? "礦點採集" : "地表開採";
    inspector.append($("p", "muted-copy", `${extractionLabel}：${building.blockedReason || "正常運作中。"}`));
  }
  if (building.type === "factory") renderFactoryControls(building);
  renderTransferControls(building);
}

function renderFactoryControls(building) {
  inspector.append($("p", "sub-label", "生產排程（總產能 100%）"));
  const recipes = getRecipeDefinitions();
  for (const job of building.jobs) {
    const recipe = recipes[job.recipeId];
    if (!recipe) continue;
    const row = $("div", "job-row");
    const info = $("div", "job-info");
    info.append($("strong", "", recipe.label));
    info.append($("small", "", `${job.allocation}% · ${job.state} · ${Math.floor(job.progress / recipe.duration * 100)}%`));
    const controls = $("div", "job-controls");
    const minus = $("button", "tiny-button", "−");
    const plus = $("button", "tiny-button", "+");
    const remove = $("button", "tiny-button danger", "×");
    minus.addEventListener("click", () => { adjustProductionAllocation(world, building.id, job.recipeId, -10); renderInspector(); });
    plus.addEventListener("click", () => { adjustProductionAllocation(world, building.id, job.recipeId, 10); renderInspector(); });
    remove.addEventListener("click", () => { removeProductionJob(world, building.id, job.recipeId); renderInspector(); });
    controls.append(minus, plus, remove);
    row.append(info, controls);
    inspector.append(row);
  }
  const addLabel = $("label", "sub-label", "新增配方");
  const select = $("select", "field-control");
  for (const recipe of Object.values(recipes)) {
    if (building.jobs.some(job => job.recipeId === recipe.id)) continue;
    const option = $("option", "", recipe.label);
    option.value = recipe.id;
    select.append(option);
  }
  const addButton = $("button", "small-button full-width", "加入生產排程");
  addButton.disabled = !select.options.length;
  addButton.addEventListener("click", () => {
    const result = addProductionJob(world, building.id, select.value);
    if (!result.ok) showNotice(result.reason);
    renderInspector();
  });
  inspector.append(addLabel, select, addButton);
}

function renderTransferControls(source) {
  const destinations = world.structures.filter(item => item.owner === "player" && item.id !== source.id);
  if (!destinations.length) return;
  transferSection.hidden = false;
  transferForm.replaceChildren();
  const destinationSelect = $("select", "field-control");
  for (const destination of destinations) {
    const option = $("option", "", `${destination.label} (${destination.x}, ${destination.y})`);
    option.value = destination.id;
    destinationSelect.append(option);
  }
  const resourceSelect = $("select", "field-control");
  const available = Object.entries(source.inventory).filter(([, amount]) => amount >= 1);
  for (const [resource] of available) {
    const option = $("option", "", getResourceDefinitions()[resource]?.label || resource);
    option.value = resource;
    resourceSelect.append(option);
  }
  const amountInput = $("input", "field-control");
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.step = "1";
  amountInput.value = available.length ? String(Math.min(10, Math.floor(available[0][1]))) : "1";
  const submit = $("button", "small-button full-width", "建立運輸訂單");
  submit.disabled = !available.length;
  submit.addEventListener("click", () => {
    const result = createTransferOrder(world, source.id, destinationSelect.value, resourceSelect.value, amountInput.value);
    if (!result.ok) showNotice(result.reason);
    else showNotice("物資已裝載，運輸途中。" );
    renderInspector();
  });
  transferForm.append(
    $("label", "field-label", "目的地"), destinationSelect,
    $("label", "field-label", "資源"), resourceSelect,
    $("label", "field-label", "數量"), amountInput,
    submit,
    $("p", "muted-copy", "物資會先從來源扣除，抵達後才加入目的地庫存。")
  );
}

function inventoryTotal(inventory) {
  return Object.values(inventory).reduce((sum, amount) => sum + amount, 0);
}
function formatAmount(amount) { return Number.isInteger(amount) ? String(amount) : amount.toFixed(1); }

function setBuildMode(type) {
  buildMode = buildMode === type ? null : type;
  updateControls();
  if (buildMode) message.textContent = `建造模式：${getBuildingDefinitions()[type].label}。點擊地圖空地放置。`;
}

function handleMapSelection(event, draggedRect) {
  if (buildMode) {
    const cell = renderer.screenToCell(event.clientX, event.clientY);
    const result = buildAt(world, buildMode, cell.x, cell.y);
    if (!result.ok) {
      showNotice(result.reason);
      return;
    }
    message.textContent = `${result.building.label} 已建造。`;
    buildMode = null;
    updateControls();
    renderInspector();
    return;
  }
  if (draggedRect) {
    const bounds = renderer.screenRectToCellBounds(draggedRect);
    const count = selectUnitsInRect(world, bounds, event.shiftKey);
    message.textContent = count ? `已框選 ${count} 支單位。` : "框選範圍內沒有我方單位。";
  } else {
    const cell = renderer.screenToCell(event.clientX, event.clientY);
    const selected = selectAt(world, cell.x, cell.y, event.shiftKey);
    message.textContent = selected?.type === "unit"
      ? `已選取 ${selected.entity.name}。`
      : selected?.type === "building" ? `已選取 ${selected.entity.label}。` : "已取消選取。";
  }
  renderInspector();
}

function onPointerDown(event) {
  if (!world || paused) return;
  if (event.button === 1) {
    pointerAction = { type: "pan", lastX: event.clientX, lastY: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (event.button !== 0) return;
  pointerAction = { type: "select", startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!pointerAction || !renderer) return;
  if (pointerAction.type === "pan") {
    renderer.panBy(event.clientX - pointerAction.lastX, event.clientY - pointerAction.lastY);
    pointerAction.lastX = event.clientX;
    pointerAction.lastY = event.clientY;
    return;
  }
  const distance = Math.hypot(event.clientX - pointerAction.startX, event.clientY - pointerAction.startY);
  pointerAction.moved = pointerAction.moved || distance > 5;
  if (pointerAction.moved) {
    const rect = canvas.getBoundingClientRect();
    const left = Math.min(pointerAction.startX, event.clientX) - rect.left;
    const top = Math.min(pointerAction.startY, event.clientY) - rect.top;
    renderer.setSelectionRect({
      x: left, y: top,
      width: Math.abs(event.clientX - pointerAction.startX),
      height: Math.abs(event.clientY - pointerAction.startY)
    });
  }
}

function onPointerUp(event) {
  if (!pointerAction) return;
  const action = pointerAction;
  pointerAction = null;
  if (action.type === "select") {
    renderer.clearSelectionRect();
    const rect = action.moved ? {
      left: Math.min(action.startX, event.clientX),
      top: Math.min(action.startY, event.clientY),
      right: Math.max(action.startX, event.clientX),
      bottom: Math.max(action.startY, event.clientY)
    } : null;
    handleMapSelection(event, rect);
  }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function onContextMenu(event) {
  event.preventDefault();
  if (!world || paused || world.winner || buildMode || !world.selectedUnitIds.length) return;
  const cell = renderer.screenToCell(event.clientX, event.clientY);
  const success = issueMove(world, world.selectedUnitIds, cell.x, cell.y);
  message.textContent = success ? `已向 ${world.selectedUnitIds.length} 支單位下達移動命令。` : "無法抵達該位置。";
}

function onWheel(event) {
  if (!world) return;
  event.preventDefault();
  renderer.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.1 : 0.9);
  updateHud();
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.mode === "personal") startPersonalGame();
    else showNotice(button.dataset.mode === "server" ? "官方公服尚未開放。" : "私人聯機尚未開放。" );
  });
});
document.querySelector("#back-home").addEventListener("click", returnHome);
pauseButton.addEventListener("click", () => { paused = !paused; updateControls(); });
speedButtons.forEach(button => button.addEventListener("click", () => { speed = Number(button.dataset.speed); updateControls(); }));
document.querySelectorAll("[data-build]").forEach(button => button.addEventListener("click", () => setBuildMode(button.dataset.build)));
cancelBuildButton.addEventListener("click", () => { buildMode = null; updateControls(); });
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", () => { pointerAction = null; renderer?.clearSelectionRect(); });
canvas.addEventListener("contextmenu", onContextMenu);
canvas.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("keydown", event => {
  if (!world) return;
  if (event.code === "Space") { event.preventDefault(); paused = !paused; updateControls(); }
  if (event.code === "Escape" && buildMode) { buildMode = null; updateControls(); }
  if (event.code === "KeyA" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    world.selectedUnitIds = world.units.filter(unit => unit.owner === "player").map(unit => unit.id);
    world.selectedBuildingId = null;
    renderInspector();
  }
});
window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => { if (!gameScreen.hidden) resizeCanvas(); });
