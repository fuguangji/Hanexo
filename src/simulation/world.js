const WIDTH = 32;
const HEIGHT = 22;

export function createWorld() {
  const world = {
    width: WIDTH,
    height: HEIGHT,
    elapsedSeconds: 0,
    selectedUnitId: null,
    winner: null,
    cells: Array.from({ length: HEIGHT }, (_, y) =>
      Array.from({ length: WIDTH }, (_, x) => ({
        terrain: terrainAt(x, y),
        owner: null,
        blocked: false
      }))
    ),
    units: [
      makeUnit("u-1", "偵察小隊", 5, 8),
      makeUnit("u-2", "防衛小隊", 5, 10),
      makeUnit("u-3", "機動小隊", 7, 9)
    ],
    structures: [
      { id: "hq-player", kind: "hq", owner: "player", x: 3, y: 9, label: "我方總部" },
      { id: "hq-enemy", kind: "hq", owner: "enemy", x: 27, y: 10, label: "敵方總指揮部" },
      { id: "outpost-1", kind: "outpost", owner: "neutral", x: 15, y: 5, label: "北部據點" },
      { id: "outpost-2", kind: "outpost", owner: "neutral", x: 17, y: 16, label: "南部據點" }
    ],
    capturedCells: 0
  };
  for (const structure of world.structures) {
    world.cells[structure.y][structure.x].blocked = true;
    world.cells[structure.y][structure.x].owner = structure.owner;
  }
  return world;
}

function makeUnit(id, name, x, y) {
  return { id, name, x, y, target: null, owner: "player", hp: 100, maxHp: 100, state: "idle", moveProgress: 0 };
}

function terrainAt(x, y) {
  const value = (x * 17 + y * 31 + x * y * 7) % 19;
  if (value === 0 || value === 1) return "rough";
  if (value === 7) return "water";
  return "plain";
}

export function selectAt(world, x, y) {
  const unit = world.units.find(item => item.owner === "player" && item.x === x && item.y === y);
  world.selectedUnitId = unit ? unit.id : null;
  return unit || null;
}

export function issueMove(world, unitId, x, y) {
  const unit = world.units.find(item => item.id === unitId);
  if (!unit || !inside(world, x, y) || !isWalkable(world, x, y)) return false;
  const occupied = world.units.some(item => item.id !== unitId && item.x === x && item.y === y);
  if (occupied) return false;
  unit.target = { x, y };
  unit.state = "moving";
  return true;
}

export function advanceWorld(world, dt) {
  world.elapsedSeconds += dt;
  for (const unit of world.units) {
    if (unit.state !== "moving" || !unit.target) continue;
    unit.moveProgress += dt;
    if (unit.moveProgress < 0.18) continue;
    unit.moveProgress = 0;
    const dx = Math.sign(unit.target.x - unit.x);
    const dy = Math.sign(unit.target.y - unit.y);
    const candidates = [];
    if (dx !== 0) candidates.push({ x: unit.x + dx, y: unit.y });
    if (dy !== 0) candidates.push({ x: unit.x, y: unit.y + dy });
    const next = candidates.find(cell => isWalkable(world, cell.x, cell.y) &&
      !world.units.some(other => other.id !== unit.id && other.x === cell.x && other.y === cell.y));
    if (!next) {
      unit.state = "idle";
      unit.target = null;
      continue;
    }
    unit.x = next.x;
    unit.y = next.y;
    if (unit.x === unit.target.x && unit.y === unit.target.y) {
      unit.state = "idle";
      unit.target = null;
    }
  }

  for (const structure of world.structures) {
    if (structure.kind !== "outpost" || structure.owner === "player") continue;
    if (world.units.some(unit => unit.owner === "player" && unit.x === structure.x && unit.y === structure.y)) {
      structure.owner = "player";
      world.cells[structure.y][structure.x].owner = "player";
    }
  }

  const enemyHQ = world.structures.find(item => item.id === "hq-enemy");
  if (enemyHQ && world.units.some(unit => unit.owner === "player" && Math.abs(unit.x - enemyHQ.x) + Math.abs(unit.y - enemyHQ.y) <= 1)) {
    enemyHQ.owner = "player";
    world.cells[enemyHQ.y][enemyHQ.x].owner = "player";
    world.winner = "player";
  }
  world.capturedCells = world.cells.flat().filter(cell => cell.owner === "player").length;
}

function isWalkable(world, x, y) {
  if (!inside(world, x, y)) return false;
  const cell = world.cells[y][x];
  return cell.terrain !== "water" && !cell.blocked;
}
function inside(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function getWorldStats(world) {
  return {
    elapsedSeconds: world.elapsedSeconds,
    playerUnits: world.units.filter(unit => unit.owner === "player").length,
    capturedCells: world.capturedCells
  };
}
