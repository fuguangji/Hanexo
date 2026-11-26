export const RESOURCE_DEFINITIONS = {
  wood: { label: "木頭", color: "#b68a55" },
  stone: { label: "石頭", color: "#aab6bd" },
  oil: { label: "石油", color: "#d3ad59" },
  iron: { label: "鐵", color: "#a5aeb7" },
  copper: { label: "銅", color: "#d58a62" },
  steel: { label: "鋼", color: "#d8e0e8" },
  arrow: { label: "箭", color: "#d3b57c" },
  ammunition: { label: "子彈", color: "#e3c17b" },
  battery: { label: "電池", color: "#84c9d9" },
  coolant: { label: "冷凍劑", color: "#82d7e8" },
  slag: { label: "爐渣", color: "#8e7b72" },
  scrap: { label: "金屬碎屑", color: "#a5aab1" },
  chemicalWaste: { label: "化學廢料", color: "#8caa82" }
};

export const RESOURCE_NODE_DEFINITIONS = {
  forest: { resource: "wood", label: "森林", amount: 1600, color: "#477e61" },
  stone: { resource: "stone", label: "石礦", amount: 1500, color: "#8d9ba2" },
  oil: { resource: "oil", label: "油田", amount: 1200, color: "#c69a4b" },
  iron: { resource: "iron", label: "鐵礦", amount: 1500, color: "#a0aab3" },
  copper: { resource: "copper", label: "銅礦", amount: 1300, color: "#ce865e" }
};

export const BUILDING_DEFINITIONS = {
  hq: { label: "總部", cost: {}, capacity: 3000, color: "#82d9f2", size: 1, kind: "hq" },
  lumberCamp: { label: "伐木場", cost: { wood: 35, stone: 10 }, capacity: 500, color: "#7aa979", size: 1, extractor: "wood" },
  quarry: { label: "採石場", cost: { wood: 30, stone: 15 }, capacity: 500, color: "#a8b4bc", size: 1, extractor: "stone" },
  oilWell: { label: "油井", cost: { wood: 45, stone: 35 }, capacity: 500, color: "#d0a64f", size: 1, extractor: "oil" },
  metalMine: { label: "金屬礦場", cost: { wood: 40, stone: 30 }, capacity: 600, color: "#c58c69", size: 1, extractor: "metal" },
  warehouse: { label: "倉庫", cost: { wood: 65, stone: 55 }, capacity: 3000, color: "#b8c6d0", size: 1 },
  factory: { label: "工廠", cost: { wood: 90, stone: 90 }, capacity: 1200, color: "#86b9d4", size: 1, productionCapacity: 1 }
};

export const RECIPES = {
  steel: {
    id: "steel", label: "煉鋼", inputs: { iron: 3, stone: 1 }, outputs: { steel: 2 }, byproducts: { slag: 1 }, duration: 5
  },
  arrows: {
    id: "arrows", label: "製箭", inputs: { wood: 2, steel: 1 }, outputs: { arrow: 4 }, byproducts: { scrap: 0.2 }, duration: 3
  },
  ammunition: {
    id: "ammunition", label: "彈藥", inputs: { copper: 2, steel: 1, oil: 1 }, outputs: { ammunition: 4 }, byproducts: { scrap: 0.5 }, duration: 4
  },
  battery: {
    id: "battery", label: "電池", inputs: { copper: 1, iron: 1 }, outputs: { battery: 1 }, byproducts: { chemicalWaste: 0.2 }, duration: 4
  },
  coolant: {
    id: "coolant", label: "冷凍劑", inputs: { stone: 1, battery: 1 }, outputs: { coolant: 1 }, byproducts: { chemicalWaste: 0.25 }, duration: 5
  }
};

export function createInventory(initial = {}) {
  return { ...initial };
}

export function inventoryUsed(inventory) {
  return Object.values(inventory).reduce((sum, amount) => sum + amount, 0);
}

export function canFit(building, additions) {
  const incoming = Object.values(additions).reduce((sum, amount) => sum + amount, 0);
  return inventoryUsed(building.inventory) + (building.reservedIncoming || 0) + incoming <= building.capacity + 1e-9;
}

export function hasInputs(inventory, inputs) {
  return Object.entries(inputs).every(([resource, amount]) => (inventory[resource] || 0) + 1e-9 >= amount);
}

export function transferDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
