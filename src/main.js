import { createWorld, advanceWorld, issueMove, selectAt, getWorldStats } from "./simulation/world.js";
import { createRenderer } from "./render/renderer.js";

const homeScreen = document.querySelector("#home-screen");
const gameScreen = document.querySelector("#game-screen");
const canvas = document.querySelector("#game-canvas");
const notice = document.querySelector("#notice");
const pauseButton = document.querySelector("#pause-button");
const clockState = document.querySelector("#clock-state");
const speedButtons = [...document.querySelectorAll("[data-speed]")];
const message = document.querySelector("#game-message");
const selectionInfo = document.querySelector("#selection-info");

let world = null;
let renderer = null;
let paused = false;
let speed = 1;
let lastFrame = 0;
let accumulator = 0;
const FIXED_STEP_MS = 100;
let noticeTimer;

function showNotice(text) {
  notice.textContent = text;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("visible"), 2600);
}

function startPersonalGame() {
  world = createWorld();
  renderer = createRenderer(canvas);
  paused = false;
  speed = 1;
  accumulator = 0;
  lastFrame = 0;
  updateControls();
  homeScreen.hidden = true;
  gameScreen.hidden = false;
  resizeCanvas();
  requestAnimationFrame(frame);
}

function returnHome() {
  gameScreen.hidden = true;
  homeScreen.hidden = false;
  world = null;
  renderer = null;
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
}

function updateHud() {
  const stats = getWorldStats(world);
  document.querySelector("#time-value").textContent = formatTime(stats.elapsedSeconds);
  document.querySelector("#unit-value").textContent = String(stats.playerUnits);
  document.querySelector("#territory-value").textContent = String(stats.capturedCells);
  if (world.selectedUnitId) {
    const unit = world.units.find(item => item.id === world.selectedUnitId);
    selectionInfo.textContent = unit ? unit.name + " · " + unit.hp + "/" + unit.maxHp + " HP · " + (unit.state === "moving" ? "移動中" : "待命") : "尚未選取單位";
  } else {
    selectionInfo.textContent = "尚未選取單位";
  }
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function frame(timestamp) {
  if (!world || !renderer) return;
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
  updateHud();
  if (world.winner && !paused) {
    paused = true;
    updateControls();
    message.textContent = "任務完成：敵方總指揮部已被佔領。";
    message.classList.add("success");
  }
  requestAnimationFrame(frame);
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.mode === "personal") startPersonalGame();
    else showNotice(button.dataset.mode === "server" ? "官方公服尚未開放。" : "私人聯機尚未開放。");
  });
});

document.querySelector("#back-home").addEventListener("click", returnHome);
pauseButton.addEventListener("click", () => { paused = !paused; updateControls(); });
speedButtons.forEach(button => button.addEventListener("click", () => { speed = Number(button.dataset.speed); updateControls(); }));

window.addEventListener("keydown", event => {
  if (event.code === "Space" && world) {
    event.preventDefault();
    paused = !paused;
    updateControls();
  }
});
window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("click", event => {
  if (!world || paused || world.winner) return;
  const cell = renderer.pointerToCell(event);
  const unit = selectAt(world, cell.x, cell.y);
  message.textContent = unit ? "已選取 " + unit.name + "。以滑鼠右鍵指定目的地。" : "沒有選取到我方單位。";
  updateHud();
});

canvas.addEventListener("contextmenu", event => {
  event.preventDefault();
  if (!world || paused || world.winner || !world.selectedUnitId) return;
  const cell = renderer.pointerToCell(event);
  message.textContent = issueMove(world, world.selectedUnitId, cell.x, cell.y) ? "移動命令已下達。" : "該位置不可通行。";
});

document.addEventListener("visibilitychange", () => {
  if (!gameScreen.hidden) resizeCanvas();
});
