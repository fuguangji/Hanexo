import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld, advanceWorld, buildAt, checkBuild, addProductionJob, removeProductionJob, adjustProductionAllocation,
  createTransferOrder, setBuildingOutput, getHQ
} from "../src/simulation/world.js";
import {
  BUILDING_DEFINITIONS, BUILDING_CATEGORIES, BUILDING_ORDER, RECIPES, RESOURCE_DEFINITIONS, acceptedResources, buildingAccepts
} from "../src/simulation/economy.js";

const richWorld = () => {
  const world = createWorld();
  const hq = getHQ(world);
  hq.capacity = 1e9;
  for (const resource of Object.keys(RESOURCE_DEFINITIONS)) hq.inventory[resource] = 5000;
  return world;
};
const place = (world, type, x, y) => {
  const result = buildAt(world, type, x, y);
  assert.equal(result.ok, true, `${type} at ${x},${y}: ${result.reason}`);
  return result.building;
};
const freeCells = world => {
  const cells = [];
  for (let y = 20; y < 30; y++) for (let x = 10; x < 40; x++) if (checkBuild(world, "warehouse", x, y).ok) cells.push({ x, y });
  return cells;
};
const placeNextFree = (world, type) => { const cell = freeCells(world)[0]; return place(world, type, cell.x, cell.y); };
const run = (world, seconds, step = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += step) advanceWorld(world, step); };
const powerPlant = (world, oil = 5000) => { const plant = placeNextFree(world, "thermalPlant"); plant.inventory.oil = oil; return plant; };

const EXPECTED_LABELS = [
  "普通礦井", "普通金屬礦井", "煉礦場", "火力發電廠", "核電站", "普通煉鋼廠", "製箭工廠", "彈藥工廠", "電池工廠", "冷凍工廠",
  "防空導彈工廠", "鈾彈工廠", "普通噴射戰鬥機工廠", "核武工廠", "轟炸機工廠", "核能研究室", "空戰導彈工廠", "高科技戰機工廠",
  "偵察機工廠", "合金工廠", "火焰噴射器", "電池發射器", "鐵絲網", "EMP機", "槍砲", "弩", "防空塔", "機場"
];

test("every building in the design table exists and has a category", () => {
  const labels = new Set(Object.values(BUILDING_DEFINITIONS).map(item => item.label));
  for (const label of EXPECTED_LABELS) assert.ok(labels.has(label), `missing building: ${label}`);
  const categories = new Set(BUILDING_CATEGORIES.map(item => item.id));
  for (const type of BUILDING_ORDER) assert.ok(categories.has(BUILDING_DEFINITIONS[type].category), `${type} has an unknown category`);
  assert.equal(BUILDING_ORDER.length, EXPECTED_LABELS.length + 1, "28 table buildings plus the warehouse");
});

test("all definitions reference known resources and recipes", () => {
  const known = new Set(Object.keys(RESOURCE_DEFINITIONS));
  const usedRecipes = new Set();
  for (const [type, definition] of Object.entries(BUILDING_DEFINITIONS)) {
    for (const resource of Object.keys(definition.cost)) assert.ok(known.has(resource), `${type} cost uses unknown ${resource}`);
    for (const id of definition.recipes || []) { assert.ok(RECIPES[id], `${type} uses unknown recipe ${id}`); usedRecipes.add(id); }
    if (definition.generator) assert.ok(known.has(definition.generator.fuel));
    for (const resource of definition.station?.ammo || []) assert.ok(known.has(resource), `${type} ammo ${resource}`);
    for (const resource of Object.keys(definition.extractor?.outputs || {})) assert.ok(known.has(resource), `${type} output ${resource}`);
    for (const resource of Object.keys(definition.extractor?.inputs || {})) assert.ok(known.has(resource));
    assert.ok(definition.capacity > 0 && definition.label && definition.look, `${type} is incomplete`);
  }
  for (const [id, recipe] of Object.entries(RECIPES)) {
    assert.ok(usedRecipes.has(id), `recipe ${id} is not produced by any building`);
    assert.ok(recipe.duration > 0);
    for (const resource of [...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs), ...Object.keys(recipe.byproducts)]) assert.ok(known.has(resource), `${id}: ${resource}`);
  }
});

test("every building can be placed and its cost is deducted exactly", () => {
  const world = richWorld();
  const deposit = { metalMine: { x: 20, y: 5 }, refinery: { x: 33, y: 6 } };
  const cells = freeCells(world);
  let index = 0;
  for (const type of BUILDING_ORDER) {
    const hq = getHQ(world);
    const before = { ...hq.inventory };
    const cell = deposit[type] || cells[index++];
    const building = place(world, type, cell.x, cell.y);
    assert.equal(building.type, type);
    for (const [resource, amount] of Object.entries(BUILDING_DEFINITIONS[type].cost)) assert.equal(hq.inventory[resource], before[resource] - amount, `${type} ${resource}`);
  }
});

test("deposit buildings need the right deposit nearby, surface mines do not", () => {
  const world = richWorld();
  assert.match(checkBuild(world, "metalMine", 12, 24).reason, /普通金屬礦/);
  assert.match(checkBuild(world, "refinery", 20, 5).reason, /稀有金屬礦/, "a refinery must not use a common deposit");
  assert.match(checkBuild(world, "metalMine", 33, 6).reason, /普通金屬礦/, "a metal mine must not use a rare deposit");
  assert.equal(checkBuild(world, "commonMine", 12, 24).ok, true);
});

test("checkBuild lists exactly what is missing and spends nothing", () => {
  const world = createWorld();
  const hq = getHQ(world);
  hq.inventory.wood = 20;
  const result = checkBuild(world, "steelworks", 10, 6);
  assert.equal(result.ok, false);
  assert.match(result.reason, /木頭 70/);
  assert.doesNotMatch(result.reason, /石頭/);
  assert.equal(hq.inventory.wood, 20);
  const advanced = checkBuild(world, "jetFactory", 10, 6);
  assert.match(advanced.reason, /鋼/);
  assert.match(advanced.reason, /電池/);
});

test("surface mine mines the selected resource", () => {
  const world = richWorld();
  const mine = placeNextFree(world, "commonMine");
  assert.equal(mine.output, "wood");
  run(world, 3);
  assert.ok(mine.inventory.wood >= 1 && !mine.inventory.oil);
  assert.equal(setBuildingOutput(world, mine.id, "oil").ok, true);
  run(world, 3);
  assert.ok(mine.inventory.oil >= 1);
  assert.equal(setBuildingOutput(world, mine.id, "iron").ok, false);
});

test("metal mine needs power, then mines the selected metal at its own rate", () => {
  const world = richWorld();
  const mine = place(world, "metalMine", 20, 5);
  run(world, 2);
  assert.equal(mine.blockedReason, "電力不足");
  assert.ok(!mine.inventory.iron);
  powerPlant(world);
  run(world, 4);
  assert.ok(mine.inventory.iron >= 3, "iron mines at the full rate");
  assert.equal(setBuildingOutput(world, mine.id, "uranium").ok, true);
  const before = world.resourceNodes.find(node => node.id === "node-common-1").amount;
  run(world, 5);
  assert.ok(mine.inventory.uranium >= 1 && mine.inventory.uranium < 4, "uranium is slower than iron");
  assert.ok(world.resourceNodes.find(node => node.id === "node-common-1").amount < before);
  assert.equal(setBuildingOutput(world, mine.id, "lithium").ok, false);
});

test("refinery consumes stone per unit and stops without it", () => {
  const world = richWorld();
  const refinery = place(world, "refinery", 33, 6);
  powerPlant(world);
  setBuildingOutput(world, refinery.id, "titanium");
  run(world, 3);
  assert.equal(refinery.inventory.titanium ?? 0, 0);
  assert.match(refinery.blockedReason, /缺少石頭/);
  refinery.inventory.stone = 10;
  run(world, 10);
  assert.ok(refinery.inventory.titanium >= 2);
  assert.ok(Math.abs(10 - refinery.inventory.stone - refinery.inventory.titanium) < 1.001, "one stone per titanium");
});

test("power plants burn fuel in proportion to load and never when idle", () => {
  const world = richWorld();
  const plant = powerPlant(world, 50);
  run(world, 10);
  assert.equal(plant.inventory.oil, 50, "no consumers, no fuel burned");
  place(world, "metalMine", 20, 5);
  run(world, 10);
  assert.ok(Math.abs(plant.inventory.oil - (50 - 0.4 * 10 * (2 / 12))) < 0.05);
  assert.ok(Math.abs(world.power.capacity - 12) < 1e-9);
});

test("a plant without fuel reports it and leaves consumers unpowered", () => {
  const world = richWorld();
  const plant = placeNextFree(world, "thermalPlant");
  place(world, "metalMine", 20, 5);
  run(world, 1);
  assert.match(plant.blockedReason, /缺少燃料/);
  assert.equal(world.power.capacity, 0);
  assert.equal(world.power.satisfaction, 0);
});

test("insufficient power slows every consumer by the same ratio", () => {
  const world = richWorld();
  powerPlant(world);
  const jet = placeNextFree(world, "jetFactory");
  const bomber = placeNextFree(world, "bomberFactory");
  jet.inventory = { steel: 100, oil: 100, battery: 100, copper: 100 };
  bomber.inventory = { steel: 100, oil: 100, battery: 100, copper: 100 };
  addProductionJob(world, jet.id, "jet");
  addProductionJob(world, bomber.id, "bomber");
  run(world, 1);
  assert.equal(world.power.demand, 16);
  assert.ok(Math.abs(world.power.satisfaction - 12 / 16) < 1e-9);
  const progress = jet.jobs[0].progress;
  assert.ok(Math.abs(progress - 1 * 0.25 * 0.75) < 0.02, `progress ${progress}`);
});

test("nuclear plant outputs four times a thermal plant and burns uranium", () => {
  const world = richWorld();
  const plant = placeNextFree(world, "nuclearPlant");
  plant.inventory.uranium = 10;
  place(world, "metalMine", 20, 5);
  run(world, 10);
  assert.equal(world.power.capacity, 48);
  assert.ok(plant.inventory.uranium < 10 && plant.inventory.uranium > 9.9);
});

test("each factory only accepts its own recipes", () => {
  const world = richWorld();
  const steelworks = placeNextFree(world, "steelworks");
  const arrows = placeNextFree(world, "arrowFactory");
  assert.equal(addProductionJob(world, steelworks.id, "arrow").ok, false);
  assert.match(addProductionJob(world, steelworks.id, "arrow").reason, /無法生產/);
  assert.equal(addProductionJob(world, arrows.id, "arrow").ok, true);
  assert.equal(addProductionJob(world, arrows.id, "steelArrow").ok, true);
  assert.equal(arrows.jobs.reduce((sum, job) => sum + job.allocation, 0), 50);
  assert.equal(addProductionJob(world, arrows.id, "arrow").ok, false, "no duplicate jobs");
});

test("factories pause without power and resume when it arrives", () => {
  const world = richWorld();
  const steelworks = placeNextFree(world, "steelworks");
  steelworks.inventory = { iron: 30, stone: 10 };
  addProductionJob(world, steelworks.id, "steel");
  adjustProductionAllocation(world, steelworks.id, "steel", 75);
  run(world, 3);
  assert.equal(steelworks.jobs[0].state, "電力不足");
  assert.equal(steelworks.jobs[0].progress, 0);
  powerPlant(world);
  run(world, 8);
  assert.ok(steelworks.inventory.steel >= 2);
  assert.ok(steelworks.inventory.slag >= 1);
});

test("every recipe of every factory completes one batch and settles inputs, outputs and byproducts atomically", () => {
  for (const type of BUILDING_ORDER.filter(item => BUILDING_DEFINITIONS[item].recipes)) {
    const world = richWorld();
    powerPlant(world);
    const factory = placeNextFree(world, type);
    for (const recipeId of BUILDING_DEFINITIONS[type].recipes) {
      const recipe = RECIPES[recipeId];
      factory.inventory = Object.fromEntries(Object.entries(recipe.inputs).map(([resource, amount]) => [resource, amount * 2]));
      assert.equal(addProductionJob(world, factory.id, recipeId).ok, true, `${type}/${recipeId}`);
      adjustProductionAllocation(world, factory.id, recipeId, 100);
      run(world, recipe.duration * 1.1 + 1, 0.5);
      for (const [resource, amount] of Object.entries(recipe.outputs)) assert.ok((factory.inventory[resource] || 0) >= amount - 1e-9, `${type}/${recipeId} should output ${resource}`);
      for (const [resource, amount] of Object.entries(recipe.byproducts)) assert.ok((factory.inventory[resource] || 0) >= amount - 1e-9, `${type}/${recipeId} should output byproduct ${resource}`);
      removeProductionJob(world, factory.id, recipeId);
    }
  }
});

test("a batch with missing inputs waits and consumes nothing", () => {
  const world = richWorld();
  powerPlant(world);
  const jets = placeNextFree(world, "jetFactory");
  jets.inventory = { steel: 5 };
  addProductionJob(world, jets.id, "jet");
  adjustProductionAllocation(world, jets.id, "jet", 100);
  run(world, 20);
  assert.equal(jets.jobs[0].state, "缺少原料");
  assert.equal(jets.inventory.steel, 5);
  assert.ok(!jets.inventory.jet);
});

test("transfers only go to buildings that accept the resource", () => {
  const world = richWorld();
  const arrows = placeNextFree(world, "arrowFactory");
  const warehouse = placeNextFree(world, "warehouse");
  const plant = placeNextFree(world, "thermalPlant");
  const rejected = createTransferOrder(world, "hq-player", arrows.id, "iron", 5);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /不接收鐵/);
  assert.equal(createTransferOrder(world, "hq-player", arrows.id, "wood", 5).ok, true);
  assert.equal(createTransferOrder(world, "hq-player", warehouse.id, "uranium", 5).ok, true, "warehouses accept everything");
  assert.equal(createTransferOrder(world, "hq-player", plant.id, "oil", 5).ok, true);
  assert.equal(createTransferOrder(world, "hq-player", plant.id, "wood", 5).ok, false);
  assert.deepEqual(acceptedResources("thermalPlant"), ["oil"]);
  assert.equal(buildingAccepts("hq", "anything"), true);
  assert.equal(buildingAccepts("commonMine", "wood"), false);
});

test("attack stations report readiness from their ammunition", () => {
  const world = richWorld();
  const gun = placeNextFree(world, "gunTurret");
  const wire = placeNextFree(world, "razorWire");
  const airfield = placeNextFree(world, "airfield");
  const crossbow = placeNextFree(world, "crossbow");
  run(world, 0.2);
  assert.equal(gun.ready, false);
  assert.match(gun.blockedReason, /缺少彈藥/);
  assert.equal(wire.ready, true, "coolant is optional for razor wire");
  assert.match(airfield.blockedReason, /沒有停放飛機/);
  assert.equal(createTransferOrder(world, "hq-player", gun.id, "bullet", 20).ok, true);
  assert.equal(createTransferOrder(world, "hq-player", gun.id, "arrow", 20).ok, false, "a gun does not take arrows");
  assert.equal(createTransferOrder(world, "hq-player", crossbow.id, "steelArrow", 20).ok, true);
  assert.equal(createTransferOrder(world, "hq-player", airfield.id, "jet", 2).ok, true);
  run(world, 20);
  assert.equal(gun.ready, true);
  assert.equal(crossbow.ready, true);
  assert.equal(airfield.ready, true);
});

test("end to end: oil well, power, iron and steel chain through manual transfers", () => {
  const world = richWorld();
  const hq = getHQ(world);
  for (const resource of Object.keys(hq.inventory)) if (!["wood", "stone"].includes(resource)) hq.inventory[resource] = 0;
  hq.inventory.wood = 1000; hq.inventory.stone = 1000; hq.inventory.oil = 20; hq.inventory.iron = 0;
  const oilWell = placeNextFree(world, "commonMine");
  setBuildingOutput(world, oilWell.id, "oil");
  const plant = placeNextFree(world, "thermalPlant");
  const mine = place(world, "metalMine", 20, 5);
  const steelworks = placeNextFree(world, "steelworks");
  createTransferOrder(world, "hq-player", plant.id, "oil", 20);
  addProductionJob(world, steelworks.id, "steel");
  adjustProductionAllocation(world, steelworks.id, "steel", 75);
  run(world, 15);
  assert.ok(mine.inventory.iron >= 5, "powered by the plant that burns the HQ oil");
  assert.ok(oilWell.inventory.oil >= 10);
  createTransferOrder(world, mine.id, steelworks.id, "iron", Math.floor(mine.inventory.iron));
  hq.inventory.stone -= 10; steelworks.inventory.stone = 10;
  run(world, 30);
  assert.ok(steelworks.inventory.steel >= 2, "steel produced from mined iron");
});
