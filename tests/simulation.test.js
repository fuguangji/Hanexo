import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, advanceWorld, issueMove, selectAt, selectUnitsInRect, buildAt, addProductionJob, createTransferOrder } from "../src/simulation/world.js";
import { findPath } from "../src/simulation/pathfinding.js";
import { getCell } from "../src/simulation/world.js";

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


test("infinite world lazily generates deterministic chunks in negative and positive coordinates", () => {
  const first = createWorld(123456);
  const second = createWorld(123456);
  assert.equal(first.width, undefined);
  assert.equal(first.height, undefined);
  const initialChunkCount = first.chunks.size;
  const farCell = getCell(first, -97, 65);
  const sameCell = getCell(second, -97, 65);
  assert.equal(farCell.terrain, sameCell.terrain);
  assert.equal(first.chunks.size, initialChunkCount + 1);
  assert.equal(getCell(first, -97, 65), farCell);
  assert.ok(["plain", "rough", "water"].includes(farCell.terrain));
});

test("world coordinates are not clamped to the old 48 by 32 map", () => {
  const world = createWorld(98765);
  const cell = getCell(world, 80, -55);
  assert.ok(cell);
  assert.ok(["plain", "rough", "water"].includes(cell.terrain));
  assert.equal(world.cells[-55][80], cell);
});
