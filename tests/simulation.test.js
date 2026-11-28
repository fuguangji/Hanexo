import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, advanceWorld, issueMove, selectAt, selectUnitsInRect, buildAt, addProductionJob, createTransferOrder } from "../src/simulation/world.js";
import { findPath } from "../src/simulation/pathfinding.js";

test("A* routes around blocked terrain and returns adjacent steps", () => {
  const world = createWorld();
  for (let y = 10; y < 20; y++) world.cells[y][10].terrain = "water";
  const path = findPath(world, { x: 8, y: 15 }, { x: 12, y: 15 });
  assert.ok(path.length > 4);
  assert.deepEqual(path.at(-1), { x: 12, y: 15 });
  assert.ok(path.every(point => world.cells[point.y][point.x].terrain !== "water"));
});

test("multi-select and group movement assign paths", () => {
  const world = createWorld();
  const count = selectUnitsInRect(world, { minX: 5, maxX: 9, minY: 14, maxY: 18 });
  assert.equal(count, 3);
  assert.equal(world.selectedUnitIds.length, 3);
  assert.equal(issueMove(world, world.selectedUnitIds, 13, 16), true);
  assert.ok(world.units.every(unit => unit.path.length > 0));
  for (let i = 0; i < 80; i++) advanceWorld(world, 0.1);
  assert.equal(new Set(world.units.map(unit => `${unit.x},${unit.y}`)).size, 3);
});

test("single selection can select a building", () => {
  const world = createWorld();
  const selected = selectAt(world, 4, 16);
  assert.equal(selected.type, "building");
  assert.equal(world.selectedBuildingId, "hq-player");
});

test("surface extractors can be placed on empty land while metal mines require one of two ore deposits", () => {
  const world = createWorld();
  const result = buildAt(world, "lumberCamp", 10, 6);
  assert.equal(result.ok, true);
  advanceWorld(world, 3);
  assert.ok(result.building.inventory.wood >= 1);
  assert.equal(world.structures.find(item => item.id === "hq-player").inventory.wood, 265);
  const mineWithoutDeposit = buildAt(world, "metalMine", 12, 12);
  assert.equal(mineWithoutDeposit.ok, false);
  const mineNearCommonOre = buildAt(world, "metalMine", 20, 5);
  assert.equal(mineNearCommonOre.ok, true);
  advanceWorld(world, 3);
  assert.ok(mineNearCommonOre.building.inventory.commonMetal >= 1);

  const mineNearRareOre = buildAt(world, "metalMine", 33, 6);
  assert.equal(mineNearRareOre.ok, true);
  const quarry = buildAt(world, "quarry", 12, 8);
  const oilWell = buildAt(world, "oilWell", 14, 8);
  assert.equal(quarry.ok, true);
  assert.equal(oilWell.ok, true);
  advanceWorld(world, 3);
  assert.ok(mineNearRareOre.building.inventory.rareMetal >= 1);
  assert.ok(quarry.building.inventory.stone >= 1);
  assert.ok(oilWell.building.inventory.oil >= 1);
});

test("manual transfer moves inventory between independent buildings", () => {
  const world = createWorld();
  const built = buildAt(world, "factory", 10, 17);
  assert.equal(built.ok, true);
  const order = createTransferOrder(world, "hq-player", built.building.id, "commonMetal", 10);
  assert.equal(order.ok, true);
  assert.equal(world.structures.find(item => item.id === "hq-player").inventory.commonMetal, 60);
  assert.equal(built.building.inventory.commonMetal, undefined);
  advanceWorld(world, 10);
  assert.equal(built.building.inventory.commonMetal, 10);
});

test("factory production consumes inputs and creates products plus byproducts", () => {
  const world = createWorld();
  const built = buildAt(world, "factory", 10, 17);
  assert.equal(built.ok, true);
  const factory = built.building;
  factory.inventory.commonMetal = 10;
  factory.inventory.stone = 10;
  assert.equal(addProductionJob(world, factory.id, "steel").ok, true);
  advanceWorld(world, 21);
  assert.ok(factory.inventory.steel >= 2);
  assert.ok(factory.inventory.slag >= 1);
  assert.ok(factory.inventory.commonMetal < 10);
  assert.ok(factory.jobs[0].allocation <= 100);
});

test("production capacity allocation cannot exceed 100 percent", () => {
  const world = createWorld();
  const built = buildAt(world, "factory", 10, 17);
  const factory = built.building;
  assert.equal(addProductionJob(world, factory.id, "steel").ok, true);
  assert.equal(addProductionJob(world, factory.id, "arrows").ok, true);
  assert.equal(factory.jobs.reduce((sum, job) => sum + job.allocation, 0), 50);
});

import { checkBuild, getWorldStats } from "../src/simulation/world.js";

test("A* returns no path to water or occupied goals and prefers smooth terrain", () => {
  const world = createWorld();
  world.cells[15][12].terrain = "water";
  assert.deepEqual(findPath(world, { x: 8, y: 15 }, { x: 12, y: 15 }), []);
  assert.deepEqual(findPath(world, { x: 8, y: 15 }, { x: 8, y: 15 }), []);
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) world.cells[y][x].terrain = "plain";
  for (let y = 12; y <= 18; y++) world.cells[y][10].terrain = "rough";
  const path = findPath(world, { x: 8, y: 15 }, { x: 12, y: 15 });
  assert.equal(path.length, 4, "crossing the rough column is cheaper than detouring around it");
  const total = path.reduce((sum, p) => sum + (world.cells[p.y][p.x].terrain === "rough" ? 1.35 : 1), 0);
  assert.ok(Math.abs(total - 4.35) < 1e-6);
  world.cells[15][10].terrain = "water";
  const detour = findPath(world, { x: 8, y: 15 }, { x: 12, y: 15 });
  assert.ok(detour.length > 4 && detour.every(p => world.cells[p.y][p.x].terrain !== "water"));
  const occupiedGoal = findPath(world, { x: 8, y: 15 }, { x: 6, y: 15 });
  assert.deepEqual(occupiedGoal, []);
  assert.equal(findPath(world, { x: 8, y: 15 }, { x: 6, y: 15 }, { ignoreUnits: true }).length, 2);
});

test("A* matches Dijkstra optimal cost on a random obstacle field", () => {
  const world = createWorld();
  world.units = [];
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    world.cells[y][x].terrain = random() < 0.18 ? "water" : random() < 0.2 ? "rough" : "plain";
    world.cells[y][x].blocked = false;
  }
  const cost = path => path.reduce((sum, p) => sum + (world.cells[p.y][p.x].terrain === "rough" ? 1.35 : 1), 0);
  const dijkstra = (start, goal) => {
    const dist = new Map([[`${start.x},${start.y}`, 0]]);
    const queue = [{ ...start, d: 0 }];
    while (queue.length) {
      queue.sort((a, b) => a.d - b.d);
      const cur = queue.shift();
      if (cur.d > dist.get(`${cur.x},${cur.y}`)) continue;
      if (cur.x === goal.x && cur.y === goal.y) return cur.d;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cur.x + dx, y = cur.y + dy;
        if (x < 0 || y < 0 || x >= world.width || y >= world.height || world.cells[y][x].terrain === "water") continue;
        const d = cur.d + (world.cells[y][x].terrain === "rough" ? 1.35 : 1);
        if (d < (dist.get(`${x},${y}`) ?? Infinity)) { dist.set(`${x},${y}`, d); queue.push({ x, y, d }); }
      }
    }
    return null;
  };
  let compared = 0;
  for (let i = 0; i < 40; i++) {
    const start = { x: Math.floor(random() * 48), y: Math.floor(random() * 32) };
    const goal = { x: Math.floor(random() * 48), y: Math.floor(random() * 32) };
    if (world.cells[start.y][start.x].terrain === "water" || world.cells[goal.y][goal.x].terrain === "water") continue;
    if (start.x === goal.x && start.y === goal.y) continue;
    const expected = dijkstra(start, goal);
    const path = findPath(world, start, goal);
    if (expected === null) { assert.deepEqual(path, []); continue; }
    assert.ok(Math.abs(cost(path) - expected) < 1e-4, `cost ${cost(path)} vs ${expected}`);
    compared += 1;
  }
  assert.ok(compared > 20);
});

test("controlled-cell counter follows building and outpost captures", () => {
  const world = createWorld();
  assert.equal(getWorldStats(world).capturedCells, 1);
  buildAt(world, "warehouse", 8, 12);
  assert.equal(getWorldStats(world).capturedCells, 2);
  world.units[0].x = 24; world.units[0].y = 8;
  advanceWorld(world, 0.1);
  assert.equal(getWorldStats(world).capturedCells, 3);
  advanceWorld(world, 0.1);
  assert.equal(getWorldStats(world).capturedCells, 3, "capturing twice must not double count");
  assert.equal(world.cells.flat().filter(cell => cell.owner === "player").length, world.capturedCells);
});

test("checkBuild explains what is missing and does not spend resources", () => {
  const world = createWorld();
  const hq = world.structures.find(item => item.id === "hq-player");
  hq.inventory.wood = 20;
  const result = checkBuild(world, "factory", 10, 6);
  assert.equal(result.ok, false);
  assert.match(result.reason, /木頭 70/);
  assert.doesNotMatch(result.reason, /石頭/, "stone is sufficient, so it must not be listed as missing");
  assert.equal(hq.inventory.wood, 20);
  assert.equal(checkBuild(world, "hq", 10, 6).ok, false);
  assert.equal(checkBuild(world, "lumberCamp", -1, 6).ok, false);
  hq.inventory.wood = 300;
  assert.equal(checkBuild(world, "lumberCamp", 10, 6).ok, true);
});

test("group move gives every unit a distinct destination, even when targets are crowded", () => {
  const world = createWorld();
  for (let i = 0; i < 9; i++) world.units.push({ id: `extra-${i}`, name: "測試", x: 6 + (i % 3), y: 20 + Math.floor(i / 3), owner: "player", hp: 100, maxHp: 100, state: "idle", path: [], moveProgress: 0 });
  const ids = world.units.map(unit => unit.id);
  assert.equal(issueMove(world, ids, 20, 16), true);
  const destinations = world.units.map(unit => unit.path.length ? unit.path.at(-1) : { x: unit.x, y: unit.y }).map(p => `${p.x},${p.y}`);
  assert.equal(new Set(destinations).size, world.units.length);
});

test("metal mine keeps working after its nearest deposit is exhausted by switching deposits", () => {
  const world = createWorld();
  const near = world.resourceNodes.find(node => node.id === "node-common-1");
  const mine = buildAt(world, "metalMine", 20, 5).building;
  advanceWorld(world, 2);
  assert.ok(mine.inventory.commonMetal >= 1);
  near.amount = 0;
  advanceWorld(world, 2);
  assert.match(mine.blockedReason || "", /耗盡|不存在/);
});
