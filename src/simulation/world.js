import { findPath } from "./pathfinding.js";
import {
  BUILDING_DEFINITIONS, RECIPES, RESOURCE_DEFINITIONS, RESOURCE_NODE_DEFINITIONS,
  canFit, createInventory, hasInputs, inventoryUsed, transferDistance
} from "./economy.js";

const CHUNK_SIZE = 32;
const MOVE_INTERVAL = 0.18;
const EXTRACT_RATE = 1.5;

export function createWorld(seed = 0x48414e45) {
  const world = {
    seed: seed >>> 0, chunks: new Map(), _cellRows: new Map(),
    elapsedSeconds: 0, selectedUnitIds: [], selectedBuildingId: null,
    winner: null, nextEntityId: 1,
    units: [
      makeUnit("u-1", "偵察小隊", 6, 15),
      makeUnit("u-2", "防衛小隊", 6, 17),
      makeUnit("u-3", "機動小隊", 8, 16)
    ],
    structures: [
      makeBuilding("hq-player", "hq", "player", 4, 16, { wood: 300, stone: 250, commonMetal: 70, oil: 20 }),
      makeBuilding("hq-enemy", "hq", "enemy", 244, 16, {}, "敵方總指揮部"),
      makeBuilding("outpost-1", "outpost", "neutral", 124, 7, {}, "北部據點"),
      makeBuilding("outpost-2", "outpost", "neutral", 124, 25, {}, "南部據點")
    ],
    resourceNodes: [], transferOrders: [], ownedCellKeys: new Set(), capturedCells: 1
  };
  world.cells = new Proxy({}, {
    get: (_, yKey) => {
      const y = Number(yKey);
      if (!Number.isInteger(y) || String(y) !== String(yKey)) return undefined;
      if (!world._cellRows.has(y)) world._cellRows.set(y, new Proxy({}, {
        get: (_, xKey) => {
          const x = Number(xKey);
          return Number.isInteger(x) && String(x) === String(xKey) ? getCell(world, x, y) : undefined;
        },
        set: (_, xKey, value) => {
          const x = Number(xKey);
          if (!Number.isInteger(x) || String(x) !== String(xKey)) return false;
          Object.assign(getCell(world, x, y), value);
          return true;
        }
      }));
      return world._cellRows.get(y);
    }
  });
  for (const structure of world.structures) {
    const cell = getCell(world, structure.x, structure.y);
    cell.blocked = true;
    cell.owner = structure.owner;
    if (structure.owner === "player") world.ownedCellKeys.add(`${structure.x},${structure.y}`);
  }
  return world;
}

function getChunk(world, cx, cy) {
  const key = `${cx},${cy}`;
  let chunk = world.chunks.get(key);
  if (chunk) return chunk;
  const cells = Array.from({ length: CHUNK_SIZE }, (_, ly) =>
    Array.from({ length: CHUNK_SIZE }, (_, lx) => {
      const x = cx * CHUNK_SIZE + lx, y = cy * CHUNK_SIZE + ly;
      return { terrain: terrainAt(x, y, world.seed), blocked: false, owner: null };
    })
  );
  chunk = { cells, nodes: [] };
  world.chunks.set(key, chunk);
  const hash = hash2(cx, cy, world.seed ^ 0x9e3779b9);
  const count = 1 + (hash % 3 === 0 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const h = hash2(cx * 7 + i * 13, cy * 11 - i * 5, world.seed ^ 0xa511e9b3);
    let x = cx * CHUNK_SIZE + 4 + h % 24;
    let y = cy * CHUNK_SIZE + 4 + (h >>> 8) % 24;
    for (let attempt = 0; attempt < 576; attempt++) {
      const cell = cells[y - cy * CHUNK_SIZE][x - cx * CHUNK_SIZE];
      const occupied = world.structures.some(item => item.x === x && item.y === y) ||
        world.units.some(item => item.x === x && item.y === y) ||
        chunk.nodes.some(item => item.x === x && item.y === y);
      if (cell.terrain !== "water" && !occupied) break;
      const offset = (attempt + 1) % 576;
      x = cx * CHUNK_SIZE + 4 + (offset % 24);
      y = cy * CHUNK_SIZE + 4 + Math.floor(offset / 24);
    }
    const type = h % 5 === 0 ? "rareMetal" : "commonMetal";
    const node = makeResourceNode(`ore-${cx}-${cy}-${i}`, type, x, y);
    chunk.nodes.push(node);
    world.resourceNodes.push(node);
  }
  return chunk;
}

export function getCell(world, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return { terrain: "water", blocked: true, owner: null };
  }
  const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE);
  return getChunk(world, cx, cy).cells[y - cy * CHUNK_SIZE][x - cx * CHUNK_SIZE];
}

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x119de1f3) ^ seed;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function makeUnit(id, name, x, y) {
  return { id, name, x, y, owner: "player", hp: 100, maxHp: 100, state: "idle", path: [], moveProgress: 0 };
}

function makeBuilding(id, type, owner, x, y, inventory = {}, customLabel = null) {
  const definition = BUILDING_DEFINITIONS[type] || { label: type, capacity: 1000, color: "#aaa", productionCapacity: 1 };
  return {
    id, type, owner, x, y, label: customLabel || definition.label || type,
    inventory: createInventory(inventory), capacity: definition.capacity || 1000,
    reservedIncoming: 0, jobs: [], productionCapacity: definition.productionCapacity || 0,
    extractProgress: 0, level: 1, quality: 1, blockedReason: null
  };
}

function makeResourceNode(id, type, x, y) {
  const definition = RESOURCE_NODE_DEFINITIONS[type];
  return { id, type, resource: definition.resource, label: definition.label, x, y, amount: definition.amount, maxAmount: definition.amount };
}

function terrainAt(x, y, seed) {
  const value = hash2(x, y, seed) % 100;
  if (value < 14) return "rough";
  if (value < 23) return "water";
  return "plain";
}

export function selectAt(world, x, y, additive = false) {
  const unit = world.units.find(item => item.owner === "player" && item.x === x && item.y === y);
  if (unit) {
    world.selectedBuildingId = null;
    if (additive) {
      world.selectedUnitIds = world.selectedUnitIds.includes(unit.id)
        ? world.selectedUnitIds.filter(id => id !== unit.id)
        : [...world.selectedUnitIds, unit.id];
    } else {
      world.selectedUnitIds = [unit.id];
    }
    return { type: "unit", entity: unit };
  }
  const building = world.structures.find(item => item.owner === "player" && item.x === x && item.y === y);
  if (building) {
    world.selectedUnitIds = [];
    world.selectedBuildingId = building.id;
    return { type: "building", entity: building };
  }
  if (!additive) {
    world.selectedUnitIds = [];
    world.selectedBuildingId = null;
  }
  return null;
}

export function selectUnitsInRect(world, bounds, additive = false) {
  const selected = world.units.filter(unit => unit.owner === "player" &&
    unit.x >= bounds.minX && unit.x <= bounds.maxX && unit.y >= bounds.minY && unit.y <= bounds.maxY
  ).map(unit => unit.id);
  world.selectedBuildingId = null;
  world.selectedUnitIds = additive
    ? [...new Set([...world.selectedUnitIds, ...selected])]
    : selected;
  return selected.length;
}

export function issueMove(world, unitIds, x, y) {
  const units = world.units.filter(unit => unitIds.includes(unit.id));
  if (!units.length || !inside(world, x, y) || !isWalkable(world, x, y, null)) return false;
  let assigned = 0;
  for (const [index, unit] of units.entries()) {
    const target = findFormationSlot(world, x, y, index, unit.id);
    if (!target) continue;
    const path = findPath(world, unit, target);
    if (path.length || (unit.x === target.x && unit.y === target.y)) {
      unit.path = path;
      unit.state = path.length ? "moving" : "idle";
      unit.moveProgress = 0;
      assigned += 1;
    }
  }
  return assigned > 0;
}

function findFormationSlot(world, x, y, index, unitId) {
  const offsets = [{ x: 0, y: 0 }];
  for (let radius = 1; radius <= 5; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      offsets.push({ x: dx, y: -radius }, { x: dx, y: radius });
    }
    for (let dy = -radius + 1; dy < radius; dy++) {
      offsets.push({ x: -radius, y: dy }, { x: radius, y: dy });
    }
  }
  for (const offset of offsets.slice(index, index + 80)) {
    const target = { x: x + offset.x, y: y + offset.y };
    if (!isWalkable(world, target.x, target.y, unitId)) continue;
    if (world.units.some(unit => unit.id !== unitId && unit.x === target.x && unit.y === target.y)) continue;
    return target;
  }
  return null;
}

export function setBuildingPlacement(world, type) {
  return Boolean(BUILDING_DEFINITIONS[type] && type !== "hq");
}

export function buildAt(world, type, x, y) {
  const definition = BUILDING_DEFINITIONS[type];
  if (!definition || type === "hq" || !inside(world, x, y)) return { ok: false, reason: "無效的建築類型或位置。" };
  if (!isWalkable(world, x, y, null) || world.resourceNodes.some(node => node.x === x && node.y === y)) {
    return { ok: false, reason: "該位置無法建造。" };
  }
  if (world.units.some(unit => unit.x === x && unit.y === y)) return { ok: false, reason: "請先移開該位置的單位。" };
  const hq = world.structures.find(item => item.id === "hq-player");
  if (!hq || !hasInputs(hq.inventory, definition.cost)) return { ok: false, reason: "總部庫存不足。" };
  if (type === "metalMine" && !findNearbyResourceNode(world, type, x, y)) {
    return { ok: false, reason: "金屬礦場必須建在普通金屬礦或稀有金屬礦附近（3 格內）。" };
  }
  for (const [resource, amount] of Object.entries(definition.cost)) hq.inventory[resource] -= amount;
  const id = `building-${world.nextEntityId++}`;
  const building = makeBuilding(id, type, "player", x, y, {});
  world.structures.push(building);
  const cell = getCell(world, x, y);
  cell.blocked = true;
  cell.owner = "player";
  world.ownedCellKeys.add(`${x},${y}`);
  world.selectedBuildingId = id;
  world.selectedUnitIds = [];
  return { ok: true, building };
}

function findNearbyResourceNode(world, buildingType, x, y) {
  const extractor = BUILDING_DEFINITIONS[buildingType].extractor;
  if (extractor !== "metal") return null;
  const minChunkX = Math.floor((x - 3) / CHUNK_SIZE);
  const maxChunkX = Math.floor((x + 3) / CHUNK_SIZE);
  const minChunkY = Math.floor((y - 3) / CHUNK_SIZE);
  const maxChunkY = Math.floor((y + 3) / CHUNK_SIZE);
  const nearbyNodes = [];
  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) nearbyNodes.push(...getChunk(world, cx, cy).nodes);
  }
  return nearbyNodes
    .filter(node => ["commonMetal", "rareMetal"].includes(node.resource))
    .filter(node => Math.abs(node.x - x) + Math.abs(node.y - y) <= 3 && node.amount > 0)
    .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - Math.abs(b.x - x) - Math.abs(b.y - y))[0] || null;
}

export function addProductionJob(world, buildingId, recipeId) {
  const building = world.structures.find(item => item.id === buildingId && item.owner === "player" && item.type === "factory");
  const recipe = RECIPES[recipeId];
  if (!building || !recipe) return { ok: false, reason: "找不到工廠或配方。" };
  if (building.jobs.some(job => job.recipeId === recipeId)) return { ok: false, reason: "此配方已在生產排程中。" };
  const allocated = building.jobs.reduce((sum, job) => sum + job.allocation, 0);
  if (allocated >= 100) return { ok: false, reason: "產能已全部分配，請先調整其他產品。" };
  building.jobs.push({ id: `${building.id}-${recipeId}`, recipeId, allocation: Math.min(25, 100 - allocated), progress: 0, state: "waiting" });
  return { ok: true };
}

export function removeProductionJob(world, buildingId, recipeId) {
  const building = world.structures.find(item => item.id === buildingId);
  if (!building) return false;
  const before = building.jobs.length;
  building.jobs = building.jobs.filter(job => job.recipeId !== recipeId);
  return building.jobs.length !== before;
}

export function adjustProductionAllocation(world, buildingId, recipeId, delta) {
  const building = world.structures.find(item => item.id === buildingId);
  const job = building?.jobs.find(item => item.recipeId === recipeId);
  if (!job) return false;
  const others = building.jobs.filter(item => item !== job).reduce((sum, item) => sum + item.allocation, 0);
  job.allocation = Math.max(0, Math.min(100 - others, job.allocation + delta));
  return true;
}
export function createTransferOrder(world, fromId, toId, resource, amount) {
  const from = world.structures.find(item => item.id === fromId && item.owner === "player");
  const to = world.structures.find(item => item.id === toId && item.owner === "player");
  const quantity = Math.floor(Number(amount));
  if (!from || !to || from === to || !RESOURCE_DEFINITIONS[resource] || !Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, reason: "調撥資料不正確。" };
  }
  if ((from.inventory[resource] || 0) < quantity) return { ok: false, reason: "來源庫存不足。" };
  if (!canFit(to, { [resource]: quantity })) return { ok: false, reason: "目的地庫存空間不足。" };
  from.inventory[resource] -= quantity;
  to.reservedIncoming += quantity;
  const distance = transferDistance(from, to);
  world.transferOrders.push({
    id: `transfer-${world.nextEntityId++}`, fromId, toId, resource, amount: quantity,
    remaining: Math.max(1, distance * 0.45), duration: Math.max(1, distance * 0.45), state: "moving"
  });
  return { ok: true };
}

export function advanceWorld(world, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  world.elapsedSeconds += dt;
  advanceUnits(world, dt);
  advanceExtraction(world, dt);
  advanceProduction(world, dt);
  advanceTransfers(world, dt);
  updateCaptures(world);
}

function advanceUnits(world, dt) {
  for (const unit of world.units) {
    if (!unit.path.length) {
      unit.state = "idle";
      continue;
    }
    unit.moveProgress += dt;
    while (unit.moveProgress >= MOVE_INTERVAL && unit.path.length) {
      unit.moveProgress -= MOVE_INTERVAL;
      const next = unit.path[0];
      const occupied = world.units.some(other => other.id !== unit.id && other.x === next.x && other.y === next.y);
      if (!isWalkable(world, next.x, next.y, unit.id) || occupied) {
        const destination = unit.path[unit.path.length - 1];
        const replacement = findPath(world, unit, destination);
        if (!replacement.length) {
          unit.path = [];
          unit.state = "idle";
          break;
        }
        unit.path = replacement;
        continue;
      }
      unit.x = next.x;
      unit.y = next.y;
      unit.path.shift();
    }
    if (!unit.path.length) unit.state = "idle";
  }
}

function advanceExtraction(world, dt) {
  for (const building of world.structures) {
    const definition = BUILDING_DEFINITIONS[building.type];
    if (!definition?.extractor) continue;
    building.extractProgress += dt * EXTRACT_RATE;
    while (building.extractProgress >= 1) {
      const extractor = definition.extractor;
      const node = extractor === "metal" ? findNearbyResourceNode(world, building.type, building.x, building.y) : null;
      const resource = extractor === "metal" ? node?.resource : extractor;
      if (!resource || !canFit(building, { [resource]: 1 })) {
        building.extractProgress = Math.min(building.extractProgress, 0.999);
        break;
      }
      if (node) node.amount = Math.max(0, node.amount - 1);
      building.inventory[resource] = (building.inventory[resource] || 0) + 1;
      building.extractProgress -= 1;
    }
    if (definition.extractor === "metal" && !findNearbyResourceNode(world, building.type, building.x, building.y)) building.blockedReason = "附近金屬礦點已耗盡或不存在";
    else if (inventoryUsed(building.inventory) >= building.capacity) building.blockedReason = "庫存已滿";
    else building.blockedReason = null;
  }
}

function advanceProduction(world, dt) {
  for (const building of world.structures) {
    if (building.type !== "factory") continue;
    for (const job of building.jobs) {
      const recipe = RECIPES[job.recipeId];
      if (!recipe || job.allocation <= 0) {
        job.state = "paused";
        continue;
      }
      const work = dt * building.productionCapacity * (job.allocation / 100) * building.quality;
      job.progress = Math.min(recipe.duration, job.progress + work);
      if (job.progress + 1e-9 < recipe.duration) {
        job.state = "working";
        continue;
      }
      const outputs = { ...recipe.outputs };
      for (const [resource, amount] of Object.entries(recipe.byproducts)) outputs[resource] = (outputs[resource] || 0) + amount;
      if (!hasInputs(building.inventory, recipe.inputs)) {
        job.progress = recipe.duration;
        job.state = "缺少原料";
        continue;
      }
      if (!canFitAfterInputs(building, recipe.inputs, outputs)) {
        job.progress = recipe.duration;
        job.state = "庫存空間不足";
        continue;
      }
      for (const [resource, amount] of Object.entries(recipe.inputs)) building.inventory[resource] = (building.inventory[resource] || 0) - amount;
      for (const [resource, amount] of Object.entries(outputs)) building.inventory[resource] = (building.inventory[resource] || 0) + amount;
      job.progress = 0;
      job.state = "working";
    }
  }
}

function canFitAfterInputs(building, inputs, outputs) {
  const usedAfterInputs = inventoryUsed(building.inventory) - Object.values(inputs).reduce((a, b) => a + b, 0);
  const outputTotal = Object.values(outputs).reduce((a, b) => a + b, 0);
  return usedAfterInputs + (building.reservedIncoming || 0) + outputTotal <= building.capacity + 1e-9;
}

function advanceTransfers(world, dt) {
  for (const order of world.transferOrders) {
    if (order.state !== "moving") continue;
    order.remaining -= dt;
    if (order.remaining > 0) continue;
    const destination = world.structures.find(item => item.id === order.toId);
    if (!destination) {
      order.state = "失敗";
      continue;
    }
    destination.reservedIncoming = Math.max(0, destination.reservedIncoming - order.amount);
    destination.inventory[order.resource] = (destination.inventory[order.resource] || 0) + order.amount;
    order.state = "完成";
  }
  world.transferOrders = world.transferOrders.filter(order => order.state === "moving");
}

function updateCaptures(world) {
  for (const structure of world.structures) {
    if (structure.type !== "outpost" || structure.owner === "player") continue;
    if (world.units.some(unit => unit.owner === "player" && Math.abs(unit.x - structure.x) + Math.abs(unit.y - structure.y) <= 1)) {
      structure.owner = "player";
      getCell(world, structure.x, structure.y).owner = "player";
      world.ownedCellKeys.add(`${structure.x},${structure.y}`);
    }
  }
  const enemyHQ = world.structures.find(item => item.id === "hq-enemy");
  if (enemyHQ && world.units.some(unit => unit.owner === "player" && Math.abs(unit.x - enemyHQ.x) + Math.abs(unit.y - enemyHQ.y) <= 1)) {
    enemyHQ.owner = "player";
    getCell(world, enemyHQ.x, enemyHQ.y).owner = "player";
    world.ownedCellKeys.add(`${enemyHQ.x},${enemyHQ.y}`);
    world.winner = "player";
  }
  world.capturedCells = world.ownedCellKeys.size;
}

export function getWorldStats(world) {
  const hq = world.structures.find(item => item.id === "hq-player");
  return {
    elapsedSeconds: world.elapsedSeconds,
    playerUnits: world.units.filter(unit => unit.owner === "player").length,
    capturedCells: world.capturedCells,
    buildings: world.structures.filter(item => item.owner === "player").length,
    hqInventory: hq?.inventory || {}
  };
}

export function getSelectedEntities(world) {
  return {
    units: world.units.filter(unit => world.selectedUnitIds.includes(unit.id)),
    building: world.structures.find(item => item.id === world.selectedBuildingId) || null
  };
}

export function getBuildingDefinitions() { return BUILDING_DEFINITIONS; }
export function getRecipeDefinitions() { return RECIPES; }
export function getResourceDefinitions() { return RESOURCE_DEFINITIONS; }
export function getResourceNodeDefinitions() { return RESOURCE_NODE_DEFINITIONS; }

function isWalkable(world, x, y, ignoreUnitId) {
  if (!inside(world, x, y)) return false;
  const cell = getCell(world, x, y);
  if (cell.terrain === "water" || cell.blocked) return false;
  return !world.units.some(unit => unit.id !== ignoreUnitId && unit.x === x && unit.y === y);
}
function inside(world, x, y) { return Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= WORLD_LIMIT && Math.abs(y) <= WORLD_LIMIT; }
