const DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 0, y: 1 }, { x: 0, y: -1 }
];

const keyOf = (x, y) => `${x},${y}`;
const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function findPath(world, start, goal, options = {}) {
  const { ignoreUnits = false, blockedGoal = false, maxVisited = 12000 } = options;
  if (!inside(world, goal.x, goal.y) || !isWalkable(world, goal.x, goal.y, ignoreUnits, blockedGoal)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const open = [{ x: start.x, y: start.y, g: 0, f: heuristic(start, goal), parent: null }];
  const best = new Map([[keyOf(start.x, start.y), 0]]);
  const closed = new Set();
  let visited = 0;

  while (open.length && visited < maxVisited) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const current = open.shift();
    const currentKey = keyOf(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited += 1;

    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let node = current;
      while (node.parent) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path.reverse();
    }

    for (const direction of DIRECTIONS) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      if (!inside(world, x, y) || !isWalkable(world, x, y, ignoreUnits, blockedGoal)) continue;
      const key = keyOf(x, y);
      if (closed.has(key)) continue;
      const g = current.g + (world.cells[y][x].terrain === "rough" ? 1.35 : 1);
      if (g >= (best.get(key) ?? Infinity)) continue;
      best.set(key, g);
      open.push({ x, y, g, f: g + heuristic({ x, y }, goal), parent: current });
    }
  }
  return [];
}

function isWalkable(world, x, y, ignoreUnits, blockedGoal) {
  const cell = world.cells[y][x];
  if (cell.terrain === "water" || cell.blocked) return false;
  if (blockedGoal && world.structures.some(item => item.x === x && item.y === y)) return false;
  return ignoreUnits || !world.units.some(unit => unit.x === x && unit.y === y);
}

function inside(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}
