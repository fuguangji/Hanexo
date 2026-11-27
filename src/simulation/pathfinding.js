const DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 0, y: 1 }, { x: 0, y: -1 }
];
const keyOf = (x, y) => `${x},${y}`;
const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].f <= value.f) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const first = items[0];
    const last = items.pop();
    if (items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1, right = left + 1;
        if (left >= items.length) break;
        const child = right < items.length && items[right].f < items[left].f ? right : left;
        if (items[child].f >= last.f) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

export function findPath(world, start, goal, options = {}) {
  const { ignoreUnits = false, blockedGoal = false, maxVisited = 50000 } = options;
  if (!inside(world, goal.x, goal.y) || !isWalkable(world, goal.x, goal.y, ignoreUnits, blockedGoal)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const open = new MinHeap();
  open.push({ x: start.x, y: start.y, g: 0, f: heuristic(start, goal), parent: null });
  const best = new Map([[keyOf(start.x, start.y), 0]]);
  const closed = new Set();
  let visited = 0;

  while (open.size && visited < maxVisited) {
    const current = open.pop();
    const currentKey = keyOf(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited++;

    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      for (let node = current; node.parent; node = node.parent) path.push({ x: node.x, y: node.y });
      return path.reverse();
    }

    for (const direction of DIRECTIONS) {
      const x = current.x + direction.x, y = current.y + direction.y;
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
  return ignoreUnits || !world.units.some(item => item.x === x && item.y === y);
}

function inside(world, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= 1_000_000 && Math.abs(y) <= 1_000_000;
}
