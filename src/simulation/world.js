import { findPath } from "./pathfinding.js";
import {
  BUILDING_DEFINITIONS, RECIPES, RESOURCE_DEFINITIONS, RESOURCE_NODE_DEFINITIONS,
  buildingAccepts, canFit, createInventory, hasInputs, inventoryUsed, transferDistance
} from "./economy.js";

const WIDTH = 48;
const HEIGHT = 32;
const MOVE_INTERVAL = 0.18;
const EXTRACT_RATE = 1.5;

export function createWorld() {
  const world = {
    width: WIDTH,
    height: HEIGHT,
    elapsedSeconds: 0,
    selectedUnitIds: [],
    selectedBuildingId: null,
    winner: null,
    nextEntityId: 1,
    cells: Array.from({ length: HEIGHT }, (_, y) =>
      Array.from({ length: WIDTH }, (_, x) => ({ terrain: terrainAt(x, y), blocked: false, owner: null }))
    ),
    units: [
      makeUnit("u-1", "偵察小隊", 6, 15),
      makeUnit("u-2", "防衛小隊", 6, 17),
      makeUnit("u-3", "機動小隊", 8, 16)
    ],
    structures: [
      makeBuilding("hq-player", "hq", "player", 4, 16, { wood: 300, stone: 250, iron: 70, copper: 20, oil: 20 }),
      makeBuilding("hq-enemy", "hq", "enemy", 43, 16, {}, "敵方總指揮部"),
      makeBuilding("outpost-1", "outpost", "neutral", 24, 7, {}, "北部據點"),
      makeBuilding("outpost-2", "outpost", "neutral", 24, 25, {}, "南部據點")
    ],
    resourceNodes: [
      makeResourceNode("node-common-1", "commonMetal", 21, 5),
      makeResourceNode("node-common-2", "commonMetal", 34, 13),
      makeResourceNode("node-rare-1", "rareMetal", 34, 6),
      makeResourceNode("node-rare-2", "rareMetal", 16, 26)
    ],
    transferOrders: [],
    power: { capacity: 0, demand: 0, satisfaction: 1 },
    capturedCells: 0
  };
  for (const structure of world.structures) {
    world.cells[structure.y][structure.x].blocked = true;
    setCellOwner(world, structure.x, structure.y, structure.owner);
  }
  return world;
}

// 玩家控制格數隨所有權變動即時維護，不必每個模擬步長掃描整張地圖。
function setCellOwner(world, x, y, owner) {
  const cell = world.cells[y][x];
  if (cell.owner === owner) return;
  if (cell.owner === "player") world.capturedCells -= 1;
  if (owner === "player") world.capturedCells += 1;
  cell.owner = owner;
}

function makeUnit(id, name, x, y) {
  return { id, name, x, y, owner: "player", hp: 100, maxHp: 100, state: "idle", path: [], moveProgress: 0 };
}

function makeBuilding(id, type, owner, x, y, inventory = {}, customLabel = null) {
  const definition = BUILDING_DEFINITIONS[type] || { label: type, capacity: 1000, color: "#aaa", productionCapacity: 1 };
  return {
    id, type, owner, x, y, label: customLabel || definition.label || type,
    inventory: createInventory(inventory), capacity: definition.capacity || 1000,
    reservedIncoming: 0, jobs: [], recipes: definition.recipes || [], productionCapacity: definition.productionCapacity || 0,
    output: definition.extractor ? Object.keys(definition.extractor.outputs)[0] : null,
    load: 0, extractProgress: 0, level: 1, quality: 1, blockedReason: null, node: null
  };
}

function makeResourceNode(id, type, x, y) {
  const definition = RESOURCE_NODE_DEFINITIONS[type];
  return { id, type, label: definition.label, x, y, amount: definition.amount, maxAmount: definition.amount };
}

function terrainAt(x, y) {
  const value = (x * 17 + y * 31 + x * y * 7) % 23;
  if (value === 0 || value === 1 || value === 2) return "rough";
  if (value === 9) return "water";
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
  const claimed = new Set();
  for (const unit of units) {
    const target = findFormationSlot(world, x, y, unit.id, claimed);
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

function findFormationSlot(world, x, y, unitId, claimed) {
  const offsets = [{ x: 0, y: 0 }];
  for (let radius = 1; radius <= 5; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      offsets.push({ x: dx, y: -radius }, { x: dx, y: radius });
    }
    for (let dy = -radius + 1; dy < radius; dy++) {
      offsets.push({ x: -radius, y: dy }, { x: radius, y: dy });
    }
  }
  for (const offset of offsets) {
    const target = { x: x + offset.x, y: y + offset.y };
    const key = target.y * world.width + target.x;
    if (claimed.has(key) || !isWalkable(world, target.x, target.y, unitId)) continue;
    claimed.add(key);
    return target;
  }
  return null;
}

export function setBuildingPlacement(world, type) {
  return Boolean(BUILDING_DEFINITIONS[type] && type !== "hq");
}

export function checkBuild(world, type, x, y) {
  const definition = BUILDING_DEFINITIONS[type];
  if (!definition || type === "hq" || !inside(world, x, y)) return { ok: false, reason: "無效的建築類型或位置。" };
  if (!isWalkable(world, x, y, null) || world.resourceNodes.some(node => node.x === x && node.y === y)) {
    return { ok: false, reason: "該位置無法建造。" };
  }
  if (world.units.some(unit => unit.x === x && unit.y === y)) return { ok: false, reason: "請先移開該位置的單位。" };
  const extractor = definition.extractor;
  if (extractor?.kind === "deposit" && !findNearbyDeposit(world, extractor.deposit, x, y)) {
    return { ok: false, reason: `${definition.label}必須建在${RESOURCE_NODE_DEFINITIONS[extractor.deposit].label}附近（3 格內）。` };
  }
  const hq = world.structures.find(item => item.id === "hq-player");
  if (!hq) return { ok: false, reason: "找不到總部。" };
  const missing = Object.entries(definition.cost)
    .filter(([resource, amount]) => (hq.inventory[resource] || 0) < amount)
    .map(([resource, amount]) => `${RESOURCE_DEFINITIONS[resource]?.label || resource} ${Math.ceil(amount - (hq.inventory[resource] || 0))}`);
  if (missing.length) return { ok: false, reason: `總部庫存不足，缺少：${missing.join("、")}。` };
  return { ok: true, hq, definition };
}

export function buildAt(world, type, x, y) {
  const check = checkBuild(world, type, x, y);
  if (!check.ok) return check;
  for (const [resource, amount] of Object.entries(check.definition.cost)) check.hq.inventory[resource] -= amount;
  const id = `building-${world.nextEntityId++}`;
  const building = makeBuilding(id, type, "player", x, y, {});
  world.structures.push(building);
  world.cells[y][x].blocked = true;
  setCellOwner(world, x, y, "player");
  world.selectedBuildingId = id;
  world.selectedUnitIds = [];
  return { ok: true, building };
}

function findNearbyDeposit(world, deposit, x, y) {
  return world.resourceNodes
    .filter(node => node.type === deposit && node.amount > 0 && Math.abs(node.x - x) + Math.abs(node.y - y) <= 3)
    .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - Math.abs(b.x - x) - Math.abs(b.y - y))[0] || null;
}

/** 選擇礦井／煉礦場要開採的資源。 */
export function setBuildingOutput(world, buildingId, resource) {
  const building = world.structures.find(item => item.id === buildingId && item.owner === "player");
  const outputs = building && BUILDING_DEFINITIONS[building.type].extractor?.outputs;
  if (!outputs || !(resource in outputs)) return { ok: false, reason: "此建築無法開採該資源。" };
  building.output = resource;
  building.extractProgress = 0;
  return { ok: true };
}

export function addProductionJob(world, buildingId, recipeId) {
  const building = world.structures.find(item => item.id === buildingId && item.owner === "player" && item.recipes.length > 0);
  const recipe = RECIPES[recipeId];
  if (!building || !recipe) return { ok: false, reason: "找不到工廠或配方。" };
  if (!building.recipes.includes(recipeId)) return { ok: false, reason: `${building.label}無法生產${recipe.label}。` };
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
  if (!buildingAccepts(to.type, resource)) return { ok: false, reason: `${to.label}不接收${RESOURCE_DEFINITIONS[resource].label}。` };
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
  advancePower(world, dt);
  advanceExtraction(world, dt);
  advanceProduction(world, dt);
  advanceStations(world);
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

// 沿用上一次的礦點；耗盡時才重新搜尋最近的礦點。
function resolveNode(world, building, deposit) {
  if (building.node && building.node.amount > 0) return building.node;
  building.node = findNearbyDeposit(world, deposit, building.x, building.y);
  return building.node;
}

// ---------- 電網：單一全域電網 ----------
// 發電廠燃燒自身庫存的燃料；耗電建築依「供電 / 需求」比例運轉。
function powerDemand(world, building, definition) {
  if (!definition?.power || building.owner !== "player") return 0;
  const extractor = definition.extractor;
  if (extractor) {
    if (extractor.kind === "deposit" && !resolveNode(world, building, extractor.deposit)) return 0;
    if (inventoryUsed(building.inventory) >= building.capacity) return 0;
    if (extractor.inputs && !hasInputs(building.inventory, extractor.inputs)) return 0;
    return definition.power;
  }
  const active = building.jobs.some(job => job.allocation > 0 && job.state !== "缺少原料" && job.state !== "庫存空間不足");
  return active ? definition.power : 0;
}

function advancePower(world, dt) {
  let capacity = 0;
  let demand = 0;
  const running = [];
  for (const building of world.structures) {
    if (building.owner !== "player") continue;
    const definition = BUILDING_DEFINITIONS[building.type];
    const generator = definition?.generator;
    if (generator) {
      const need = generator.rate * dt;
      if ((building.inventory[generator.fuel] || 0) + 1e-9 >= need) {
        capacity += generator.output;
        running.push({ building, generator, need });
        building.blockedReason = null;
      } else {
        building.load = 0;
        building.blockedReason = `缺少燃料（${RESOURCE_DEFINITIONS[generator.fuel].label}）`;
      }
    }
    demand += powerDemand(world, building, definition);
  }
  const load = capacity > 0 ? Math.min(1, demand / capacity) : 0;
  for (const { building, generator, need } of running) {
    building.inventory[generator.fuel] = Math.max(0, building.inventory[generator.fuel] - need * load);
    building.load = load;
  }
  world.power = { capacity, demand, satisfaction: demand <= 0 ? 1 : Math.min(1, capacity / demand) };
}

function advanceExtraction(world, dt) {
  const satisfaction = world.power.satisfaction;
  for (const building of world.structures) {
    const definition = BUILDING_DEFINITIONS[building.type];
    const extractor = definition?.extractor;
    if (!extractor || building.owner !== "player") continue;
    const resource = building.output;
    const node = extractor.kind === "deposit" ? (building.node = resolveNode(world, building, extractor.deposit)) : null;
    const powered = definition.power ? satisfaction : 1;
    let reason = null;
    if (extractor.kind === "deposit" && !node) reason = "附近礦點已耗盡或不存在";
    else if (inventoryUsed(building.inventory) >= building.capacity) reason = "庫存已滿";
    else if (extractor.inputs && !hasInputs(building.inventory, extractor.inputs)) {
      reason = `缺少${Object.keys(extractor.inputs).map(item => RESOURCE_DEFINITIONS[item].label).join("、")}`;
    } else if (powered <= 1e-9) reason = "電力不足";

    if (!reason) {
      building.extractProgress += dt * EXTRACT_RATE * (extractor.outputs[resource] ?? 1) * powered;
      while (building.extractProgress >= 1) {
        const unitInputs = extractor.inputs || {};
        if (!canFit(building, { [resource]: 1 - Object.values(unitInputs).reduce((a, b) => a + b, 0) }) || !hasInputs(building.inventory, unitInputs)) {
          building.extractProgress = Math.min(building.extractProgress, 0.999);
          break;
        }
        for (const [input, amount] of Object.entries(unitInputs)) building.inventory[input] -= amount;
        if (node) node.amount = Math.max(0, node.amount - 1);
        building.inventory[resource] = (building.inventory[resource] || 0) + 1;
        building.extractProgress -= 1;
      }
    }
    building.blockedReason = reason;
  }
}

// 攻擊站：彈藥就緒狀態。傷害與射擊在戰鬥系統（M5）實作後接上。
function advanceStations(world) {
  for (const building of world.structures) {
    const station = BUILDING_DEFINITIONS[building.type]?.station;
    if (!station || building.owner !== "player") continue;
    const stock = station.ammo.reduce((sum, resource) => sum + (building.inventory[resource] || 0), 0);
    building.ready = station.optionalAmmo || stock >= 1;
    building.blockedReason = building.ready ? null : (station.aircraft ? "沒有停放飛機" : "缺少彈藥");
  }
}

function advanceProduction(world, dt) {
  for (const building of world.structures) {
    if (!building.recipes.length || building.owner !== "player") continue;
    const powerNeeded = BUILDING_DEFINITIONS[building.type].power > 0;
    for (const job of building.jobs) {
      const recipe = RECIPES[job.recipeId];
      if (!recipe || job.allocation <= 0) {
        job.state = "paused";
        continue;
      }
      if (powerNeeded && world.power.satisfaction <= 1e-9) {
        job.state = "電力不足";
        continue;
      }
      const work = dt * building.productionCapacity * (job.allocation / 100) * building.quality * (powerNeeded ? world.power.satisfaction : 1);
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
  if (world.transferOrders.some(order => order.state !== "moving")) {
    world.transferOrders = world.transferOrders.filter(order => order.state === "moving");
  }
}

function updateCaptures(world) {
  for (const structure of world.structures) {
    if (structure.type !== "outpost" || structure.owner === "player") continue;
    if (world.units.some(unit => unit.owner === "player" && Math.abs(unit.x - structure.x) + Math.abs(unit.y - structure.y) <= 1)) {
      structure.owner = "player";
      setCellOwner(world, structure.x, structure.y, "player");
    }
  }
  const enemyHQ = world.structures.find(item => item.id === "hq-enemy");
  if (enemyHQ && world.units.some(unit => unit.owner === "player" && Math.abs(unit.x - enemyHQ.x) + Math.abs(unit.y - enemyHQ.y) <= 1)) {
    enemyHQ.owner = "player";
    setCellOwner(world, enemyHQ.x, enemyHQ.y, "player");
    world.winner = "player";
  }
}

export function getWorldStats(world) {
  const hq = world.structures.find(item => item.id === "hq-player");
  return {
    elapsedSeconds: world.elapsedSeconds,
    playerUnits: world.units.filter(unit => unit.owner === "player").length,
    capturedCells: world.capturedCells,
    buildings: world.structures.filter(item => item.owner === "player").length,
    hqInventory: hq?.inventory || {},
    power: world.power
  };
}

export function getSelectedEntities(world) {
  return {
    units: world.units.filter(unit => world.selectedUnitIds.includes(unit.id)),
    building: world.structures.find(item => item.id === world.selectedBuildingId) || null
  };
}

export function getHQ(world) { return world.structures.find(item => item.id === "hq-player") || null; }
export function getBuildingDefinitions() { return BUILDING_DEFINITIONS; }
export function getRecipeDefinitions() { return RECIPES; }
export function getResourceDefinitions() { return RESOURCE_DEFINITIONS; }
export function getResourceNodeDefinitions() { return RESOURCE_NODE_DEFINITIONS; }

function isWalkable(world, x, y, ignoreUnitId) {
  if (!inside(world, x, y)) return false;
  const cell = world.cells[y][x];
  if (cell.terrain === "water" || cell.blocked) return false;
  return !world.units.some(unit => unit.id !== ignoreUnitId && unit.x === x && unit.y === y);
}
function inside(world, x, y) { return x >= 0 && y >= 0 && x < world.width && y < world.height; }
