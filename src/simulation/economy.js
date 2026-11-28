// 資料驅動的經濟規則：資源、礦點、配方與全部建築。
// 新增建築或配方只需要在這裡加資料；世界模擬、建造選單與檢視器都從這些定義讀取。

export const RESOURCE_DEFINITIONS = {
  // 地表資源
  wood: { label: "木頭", color: "#b68a55" },
  stone: { label: "石頭", color: "#aab6bd" },
  oil: { label: "石油", color: "#d3ad59" },
  // 普通金屬
  iron: { label: "鐵", color: "#a9b3b8" },
  copper: { label: "銅", color: "#d08a5a" },
  uranium: { label: "鈾", color: "#9fd86f" },
  tungsten: { label: "鎢", color: "#8f97b8" },
  // 稀有金屬（煉礦場）
  lithium: { label: "鋰", color: "#d8a5c8" },
  aluminum: { label: "鋁", color: "#c8d0d6" },
  titanium: { label: "鈦", color: "#9fb3c8" },
  chromium: { label: "鉻", color: "#7fc8c0" },
  manganese: { label: "錳", color: "#b07fb8" },
  magnesium: { label: "鎂", color: "#e0e0c0" },
  zinc: { label: "鋅", color: "#8fb0c0" },
  // 鋼與合金
  steel: { label: "鋼", color: "#d8e0e8" },
  stainlessSteel: { label: "不鏽鋼", color: "#e6eef2" },
  lightSteel: { label: "輕鋼", color: "#cfe0ea" },
  toughSteel: { label: "韌鋼", color: "#b9c6d2" },
  attackSteel: { label: "攻擊鋼", color: "#e0a08a" },
  armorSteel: { label: "裝甲鋼", color: "#8d9aa6" },
  // 彈藥與武器
  arrow: { label: "箭", color: "#d3b57c" },
  armorPiercingArrow: { label: "穿甲箭", color: "#c9a0d0" },
  steelArrow: { label: "鋼箭", color: "#d0d8e0" },
  bullet: { label: "子彈", color: "#e3c17b" },
  steelBullet: { label: "鋼子彈", color: "#d6dde4" },
  missile: { label: "導彈", color: "#e0836a" },
  airMissile: { label: "空戰導彈", color: "#e0a06a" },
  uraniumShell: { label: "鈾彈", color: "#b8e08a" },
  atomBomb: { label: "原子彈", color: "#f0d060" },
  // 載具與科技
  jet: { label: "噴射機", color: "#a8c8e8" },
  bomber: { label: "轟炸機", color: "#8fb0d0" },
  highAltFighter: { label: "高空戰鬥機", color: "#c0d8f0" },
  recon: { label: "偵察機", color: "#a0d8d0" },
  techPoints: { label: "技術點", color: "#8fe3a0" },
  // 能源與化工
  battery: { label: "電池", color: "#84c9d9" },
  coolant: { label: "冷凍劑", color: "#82d7e8" },
  // 副產品
  slag: { label: "爐渣", color: "#8e7b72" },
  scrap: { label: "金屬碎屑", color: "#a5aab1" },
  chemicalWaste: { label: "化學廢料", color: "#8caa82" }
};

export const RESOURCE_NODE_DEFINITIONS = {
  commonMetal: { label: "普通金屬礦", amount: 2400, color: "#9caab4", short: "M" },
  rareMetal: { label: "稀有金屬礦", amount: 1200, color: "#d6a24f", short: "R" }
};

// ---------- 配方 ----------
const recipe = (id, label, inputs, outputs, duration, byproducts = {}) => ({ id, label, inputs, outputs, byproducts, duration });

export const RECIPES = Object.fromEntries([
  // 製箭工廠
  recipe("arrow", "箭", { wood: 2 }, { arrow: 4 }, 3),
  recipe("armorPiercingArrow", "穿甲箭", { wood: 1, tungsten: 1 }, { armorPiercingArrow: 4 }, 3, { scrap: 0.2 }),
  recipe("steelArrow", "鋼箭", { wood: 1, steel: 1 }, { steelArrow: 4 }, 3, { scrap: 0.2 }),
  // 彈藥工廠
  recipe("bullet", "子彈", { copper: 1, oil: 1 }, { bullet: 4 }, 4, { scrap: 0.3 }),
  recipe("steelBullet", "鋼子彈", { steel: 1, oil: 1 }, { steelBullet: 4 }, 4, { scrap: 0.5 }),
  // 普通煉鋼廠
  recipe("steel", "煉鋼", { iron: 3, stone: 1 }, { steel: 2 }, 5, { slag: 1 }),
  // 電池工廠（四種原料組合）
  recipe("batteryCopperIron", "電池（銅＋鐵）", { copper: 1, iron: 1 }, { battery: 2 }, 4, { chemicalWaste: 0.2 }),
  recipe("batteryUranium", "電池（石頭＋鈾）", { stone: 2, uranium: 1 }, { battery: 4 }, 5, { chemicalWaste: 0.4 }),
  recipe("batteryLithium", "電池（鋰＋銅）", { lithium: 1, copper: 1 }, { battery: 3 }, 4, { chemicalWaste: 0.15 }),
  recipe("batteryZincManganese", "電池（鋅＋錳）", { zinc: 1, manganese: 1 }, { battery: 2 }, 4, { chemicalWaste: 0.1 }),
  // 冷凍工廠
  recipe("coolant", "冷凍劑", { stone: 1, battery: 1 }, { coolant: 1 }, 5, { chemicalWaste: 0.25 }),
  // 合金工廠
  recipe("stainlessSteel", "不鏽鋼", { steel: 1, chromium: 1, manganese: 1 }, { stainlessSteel: 2 }, 6, { slag: 0.3 }),
  recipe("lightSteel", "輕鋼", { aluminum: 1, magnesium: 1 }, { lightSteel: 2 }, 5, { slag: 0.2 }),
  recipe("toughSteel", "韌鋼", { titanium: 1, zinc: 1 }, { toughSteel: 2 }, 6, { slag: 0.2 }),
  recipe("attackSteel", "攻擊鋼", { tungsten: 1, titanium: 1 }, { attackSteel: 2 }, 6, { slag: 0.3 }),
  recipe("armorSteel", "裝甲鋼", { chromium: 1, manganese: 1, titanium: 1 }, { armorSteel: 2 }, 7, { slag: 0.4 }),
  // 導彈、鈾彈、核武
  recipe("missile", "防空導彈", { copper: 1, oil: 1, steel: 1 }, { missile: 1 }, 6, { scrap: 0.3 }),
  recipe("uraniumShell", "鈾彈", { uranium: 1, steel: 1, oil: 1 }, { uraniumShell: 2 }, 6, { chemicalWaste: 0.2 }),
  recipe("atomBomb", "原子彈", { missile: 1, uranium: 2 }, { atomBomb: 1 }, 20, { chemicalWaste: 0.5 }),
  recipe("airMissile", "空戰導彈", { tungsten: 1, steel: 1, oil: 1, copper: 1 }, { airMissile: 1 }, 8, { scrap: 0.3 }),
  // 飛機
  recipe("jet", "噴射機", { steel: 2, oil: 2, battery: 1, copper: 1 }, { jet: 1 }, 12, { scrap: 0.5 }),
  recipe("bomber", "轟炸機", { steel: 3, oil: 3, battery: 1, copper: 2 }, { bomber: 1 }, 15, { scrap: 0.6 }),
  recipe("highAltFighter", "高空戰鬥機", { copper: 2, steel: 3, techPoints: 1, oil: 2, battery: 2 }, { highAltFighter: 1 }, 20, { scrap: 0.8 }),
  recipe("recon", "偵察機", { copper: 1, steel: 1, oil: 1, battery: 1 }, { recon: 1 }, 10, { scrap: 0.3 }),
  // 核能研究室
  recipe("research", "核能研究", { uranium: 1 }, { techPoints: 1 }, 8, { chemicalWaste: 0.2 })
].map(item => [item.id, item]));

// ---------- 建築 ----------
export const BUILDING_CATEGORIES = [
  { id: "extraction", label: "採集" },
  { id: "energy", label: "能源" },
  { id: "industry", label: "工業" },
  { id: "munitions", label: "軍火" },
  { id: "aviation", label: "航空" },
  { id: "defense", label: "攻擊站" },
  { id: "storage", label: "儲存" }
];

const MINE_BASE = { size: 1, capacity: 600 };

// 工廠：工廠耗材由配方決定，這裡只定義成本、用電與外觀。
const factory = (label, glyph, color, cost, recipes, options = {}) => ({
  label, glyph, color, cost, recipes, size: 1, capacity: options.capacity ?? 1200,
  productionCapacity: 1, power: options.power ?? 4, category: options.category ?? "industry",
  look: options.look ?? "factory", note: options.note
});

// 攻擊站：目前只有放置、彈藥補給與射程；傷害等戰鬥系統（M5）完成後接上。
const station = (label, glyph, color, cost, ammo, options = {}) => ({
  label, glyph, color, cost, size: 1, capacity: options.capacity ?? 300, category: "defense",
  look: options.look ?? "turret", station: { ammo, range: options.range ?? 5, optionalAmmo: options.optionalAmmo ?? false, aircraft: options.aircraft ?? false },
  note: options.note
});

export const BUILDING_DEFINITIONS = {
  hq: { label: "總部", glyph: "部", cost: {}, capacity: 3000, color: "#e8a23c", size: 1, look: "hq", category: "storage", hidden: true },
  warehouse: { label: "倉庫", glyph: "倉", cost: { wood: 65, stone: 55 }, capacity: 3000, color: "#b8c6d0", size: 1, look: "warehouse", category: "storage" },

  // 採集
  commonMine: {
    ...MINE_BASE, label: "普通礦井", glyph: "礦", color: "#7aa979", cost: { wood: 35, stone: 15 }, capacity: 500, look: "surface", category: "extraction",
    extractor: { kind: "surface", outputs: { wood: 1, stone: 1, oil: 1 } },
    note: "可直接建在空白地塊；選擇開採木頭、石頭或石油。"
  },
  metalMine: {
    ...MINE_BASE, label: "普通金屬礦井", glyph: "金", color: "#c58c69", cost: { wood: 40, stone: 30 }, power: 2, look: "mine", category: "extraction",
    extractor: { kind: "deposit", deposit: "commonMetal", outputs: { iron: 1, copper: 1, tungsten: 0.5, uranium: 0.4 } },
    note: "須在普通金屬礦 3 格內；選擇開採鐵、銅、鈾或鎢。"
  },
  refinery: {
    ...MINE_BASE, label: "煉礦場", glyph: "煉", color: "#c8a0d0", cost: { wood: 60, stone: 60, iron: 20 }, power: 3, look: "refinery", category: "extraction",
    extractor: { kind: "deposit", deposit: "rareMetal", inputs: { stone: 1 }, outputs: { lithium: 0.5, aluminum: 1, titanium: 0.5, chromium: 0.6, manganese: 0.8, magnesium: 0.8, zinc: 0.8, tungsten: 0.4 } },
    note: "須在稀有金屬礦 3 格內；每產出 1 單位消耗 1 石頭，可選鋰、鋁、鈦、鉻、錳、鎂、鋅或鎢。"
  },

  // 能源（單一全域電網）
  thermalPlant: {
    label: "火力發電廠", glyph: "火", color: "#d9884a", cost: { wood: 60, stone: 50 }, capacity: 400, size: 1, look: "plant", category: "energy",
    generator: { output: 12, fuel: "oil", rate: 0.4 }, note: "燃燒自身庫存的石油發電；需先把石油調撥進來。"
  },
  nuclearPlant: {
    label: "核電站", glyph: "核", color: "#9fd86f", cost: { stone: 150, iron: 60, copper: 40, steel: 80 }, capacity: 400, size: 1, look: "nuclear", category: "energy",
    generator: { output: 48, fuel: "uranium", rate: 0.05 }, note: "燃燒自身庫存的鈾發電，輸出是火力發電廠的 4 倍。"
  },

  // 工業
  steelworks: factory("普通煉鋼廠", "鋼", "#86b9d4", { wood: 90, stone: 90 }, ["steel"]),
  batteryFactory: factory("電池工廠", "池", "#84c9d9", { wood: 80, stone: 70, iron: 30, copper: 20 }, ["batteryCopperIron", "batteryUranium", "batteryLithium", "batteryZincManganese"]),
  coolantFactory: factory("冷凍工廠", "冷", "#82d7e8", { wood: 70, stone: 70, iron: 20, steel: 10 }, ["coolant"]),
  alloyFactory: factory("合金工廠", "合", "#b9c6d2", { wood: 60, stone: 80, iron: 40, steel: 40 }, ["stainlessSteel", "lightSteel", "toughSteel", "attackSteel", "armorSteel"], { power: 6 }),
  researchLab: factory("核能研究室", "研", "#8fe3a0", { stone: 100, iron: 40, copper: 40, steel: 60 }, ["research"], { power: 6, look: "lab", capacity: 800 }),

  // 軍火
  arrowFactory: factory("製箭工廠", "箭", "#d3b57c", { wood: 70, stone: 50, iron: 15 }, ["arrow", "armorPiercingArrow", "steelArrow"], { category: "munitions" }),
  ammoFactory: factory("彈藥工廠", "彈", "#e3c17b", { wood: 70, stone: 60, iron: 25, copper: 10 }, ["bullet", "steelBullet"], { category: "munitions" }),
  samFactory: factory("防空導彈工廠", "導", "#e0836a", { stone: 60, iron: 30, copper: 30, steel: 40 }, ["missile"], { category: "munitions", power: 6 }),
  uraniumShellFactory: factory("鈾彈工廠", "鈾", "#b8e08a", { stone: 80, copper: 20, steel: 50 }, ["uraniumShell"], { category: "munitions", power: 6 }),
  airMissileFactory: factory("空戰導彈工廠", "空", "#e0a06a", { stone: 80, copper: 30, steel: 50 }, ["airMissile"], { category: "munitions", power: 6 }),
  nuclearWeaponFactory: factory("核武工廠", "武", "#f0d060", { stone: 120, copper: 50, steel: 100, uranium: 5 }, ["atomBomb"], { category: "munitions", power: 10, look: "silo" }),

  // 航空
  jetFactory: factory("普通噴射戰鬥機工廠", "噴", "#a8c8e8", { stone: 80, copper: 40, steel: 80, battery: 10 }, ["jet"], { category: "aviation", power: 8, look: "hangar" }),
  bomberFactory: factory("轟炸機工廠", "炸", "#8fb0d0", { stone: 80, copper: 40, steel: 80, battery: 10 }, ["bomber"], { category: "aviation", power: 8, look: "hangar" }),
  reconFactory: factory("偵察機工廠", "偵", "#a0d8d0", { stone: 70, copper: 30, steel: 60, battery: 10 }, ["recon"], { category: "aviation", power: 6, look: "hangar" }),
  hiTechFactory: factory("高科技戰機工廠", "高", "#c0d8f0", { stone: 120, copper: 60, steel: 120, battery: 20, techPoints: 20 }, ["highAltFighter"], { category: "aviation", power: 10, look: "hangar" }),

  // 攻擊站
  flamethrower: station("火焰噴射器", "焰", "#e07a3a", { wood: 40, stone: 20, iron: 10 }, ["wood", "oil"], { range: 3, look: "flame", note: "消耗木頭與石油。" }),
  batteryLauncher: station("電池發射器", "電", "#84c9d9", { stone: 20, iron: 30, copper: 20 }, ["battery"], { range: 6, look: "bolt", note: "消耗電池。" }),
  razorWire: station("鐵絲網", "網", "#b0b8b0", { wood: 15, iron: 10 }, ["coolant"], { range: 1, optionalAmmo: true, look: "wire", capacity: 100, note: "冷凍劑非必需；補給後可附加冷凍效果。" }),
  empGun: station("EMP機", "磁", "#c0a0e8", { copper: 30, steel: 20, battery: 10 }, ["copper", "battery"], { range: 7, look: "emp", note: "消耗銅與電池。" }),
  gunTurret: station("槍砲", "砲", "#a8a090", { stone: 20, iron: 30, steel: 15 }, ["bullet", "steelBullet"], { range: 6, look: "turret", note: "消耗各類子彈。" }),
  crossbow: station("弩", "弩", "#c8a870", { wood: 40, stone: 10, iron: 10 }, ["arrow", "armorPiercingArrow", "steelArrow"], { range: 5, look: "crossbow", note: "消耗各類箭。" }),
  aaTower: station("防空塔", "防", "#e0836a", { stone: 40, copper: 20, steel: 30 }, ["missile"], { range: 9, look: "aa", note: "消耗防空導彈。" }),
  airfield: station("機場", "機", "#a8c8e8", { stone: 100, iron: 40, copper: 20, steel: 60 }, ["jet", "bomber", "highAltFighter", "recon"], { range: 12, look: "airfield", aircraft: true, capacity: 200, note: "停放各類飛機。" })
};

/** 建築可接收哪些資源。回傳 null 代表什麼都收（總部、倉庫）。 */
export function acceptedResources(type) {
  const definition = BUILDING_DEFINITIONS[type];
  if (!definition) return [];
  if (type === "hq" || type === "warehouse") return null;
  const accepted = new Set();
  for (const id of definition.recipes || []) for (const resource of Object.keys(RECIPES[id].inputs)) accepted.add(resource);
  if (definition.generator) accepted.add(definition.generator.fuel);
  if (definition.extractor?.inputs) for (const resource of Object.keys(definition.extractor.inputs)) accepted.add(resource);
  for (const resource of definition.station?.ammo || []) accepted.add(resource);
  return [...accepted];
}

export function buildingAccepts(type, resource) {
  const accepted = acceptedResources(type);
  return accepted === null || accepted.includes(resource);
}

export const BUILDING_ORDER = Object.keys(BUILDING_DEFINITIONS).filter(type => !BUILDING_DEFINITIONS[type].hidden);

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
