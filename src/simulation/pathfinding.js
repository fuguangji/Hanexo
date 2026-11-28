// A* 四方向尋路：二元堆 + 數字索引，避免每次展開節點都排序陣列、建立字串鍵。
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];
const ROUGH_COST = 1.35;

class MinHeap {
  constructor(score) {
    this.items = [];
    this.score = score;
  }
  get size() { return this.items.length; }
  push(index) {
    const items = this.items;
    items.push(index);
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.score(items[parent], items[child]) <= 0) break;
      [items[parent], items[child]] = [items[child], items[parent]];
      child = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < items.length && this.score(items[left], items[smallest]) < 0) smallest = left;
        if (right < items.length && this.score(items[right], items[smallest]) < 0) smallest = right;
        if (smallest === parent) break;
        [items[parent], items[smallest]] = [items[smallest], items[parent]];
        parent = smallest;
      }
    }
    return top;
  }
}

export function findPath(world, start, goal, options = {}) {
  const { ignoreUnits = false, blockedGoal = false, maxVisited = 12000 } = options;
  const { width, height } = world;
  if (!inside(world, goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  // 單位占用只掃一次，之後以格索引查表。起點是移動者自己，不算阻擋。
  const startIndex = start.y * width + start.x;
  const occupied = new Set();
  if (!ignoreUnits) {
    for (const unit of world.units) {
      const index = unit.y * width + unit.x;
      if (index !== startIndex) occupied.add(index);
    }
  }
  const structureCells = blockedGoal ? new Set(world.structures.map(item => item.y * width + item.x)) : null;
  const walkable = index => {
    const cell = world.cells[(index / width) | 0][index % width];
    if (cell.terrain === "water" || cell.blocked) return false;
    if (structureCells?.has(index)) return false;
    return !occupied.has(index);
  };

  const goalIndex = goal.y * width + goal.x;
  if (!walkable(goalIndex)) return [];

  const total = width * height;
  const g = new Float32Array(total).fill(Infinity);
  const f = new Float32Array(total);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heuristic = index => Math.abs((index % width) - goal.x) + Math.abs(((index / width) | 0) - goal.y);

  // f 相同時優先展開 g 較大的節點，讓路徑更直接。
  const heap = new MinHeap((a, b) => f[a] - f[b] || g[b] - g[a]);
  g[startIndex] = 0;
  f[startIndex] = heuristic(startIndex);
  heap.push(startIndex);

  let visited = 0;
  while (heap.size && visited < maxVisited) {
    const current = heap.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    visited += 1;

    if (current === goalIndex) {
      const path = [];
      for (let node = current; node !== startIndex; node = parent[node]) {
        path.push({ x: node % width, y: (node / width) | 0 });
      }
      return path.reverse();
    }

    const cx = current % width;
    const cy = (current / width) | 0;
    for (let d = 0; d < 4; d++) {
      const x = cx + DX[d];
      const y = cy + DY[d];
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const next = y * width + x;
      if (closed[next] || !walkable(next)) continue;
      const cost = g[current] + (world.cells[y][x].terrain === "rough" ? ROUGH_COST : 1);
      if (cost >= g[next]) continue;
      g[next] = cost;
      f[next] = cost + heuristic(next);
      parent[next] = current;
      heap.push(next);
    }
  }
  return [];
}

function inside(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}
