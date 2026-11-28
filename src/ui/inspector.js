import {
  addProductionJob, removeProductionJob, adjustProductionAllocation, createTransferOrder,
  getSelectedEntities, getRecipeDefinitions, getResourceDefinitions
} from "../simulation/world.js";
import { el, formatAmount, inventoryTotal } from "./dom.js";

const EXTRACTORS = ["lumberCamp", "quarry", "oilWell", "metalMine"];

/**
 * 檢視器與調撥表單。每次更新先算「簽章」，內容沒變就完全不動 DOM，
 * 這樣輸入框、下拉選單不會被打斷，也省去每 400 毫秒重建一次節點。
 */
const JOB_STATES = { waiting: "待命", working: "生產中", paused: "已暫停" };

export function createInspector({ root, transferSection, transferForm, hint, getWorld, notify, onWorldChange = () => {}, isInspectorOpen, isLogisticsOpen }) {
  let inspectorSignature = "";
  let transferSignature = "";

  function refresh(force = false) {
    const world = getWorld();
    if (!world) return;
    const selected = getSelectedEntities(world);
    hint.textContent = selectionSummary(selected);
    if (isLogisticsOpen()) refreshTransfer(world, selected.building, force);
    if (isInspectorOpen()) refreshInspector(world, selected, force);
  }

  function selectionSummary({ units, building }) {
    if (units.length) return units.length === 1 ? units[0].name : `已選 ${units.length} 支單位`;
    return building ? building.label : "未選取";
  }

  function refreshInspector(world, selected, force) {
    const signature = JSON.stringify(selected.units.length
      ? selected.units.map(unit => [unit.id, unit.hp, unit.state])
      : selected.building ? [selected.building.id, selected.building.inventory, selected.building.reservedIncoming, selected.building.blockedReason,
        selected.building.jobs.map(job => [job.recipeId, job.allocation, job.state, Math.floor(job.progress * 4)])] : null);
    if (!force && signature === inspectorSignature) return;
    inspectorSignature = signature;
    // 使用者正在操作下拉選單時不重建，避免選項被收起。
    if (!force && root.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return;
    root.replaceChildren();

    if (selected.units.length) return renderUnits(selected.units);
    if (!selected.building) return root.append(el("p", "muted-copy", "選取單位或建築以查看資訊。"));
    renderBuilding(world, selected.building);
  }

  function renderUnits(units) {
    root.append(el("p", "inspector-title", units.length === 1 ? units[0].name : `已選取 ${units.length} 支單位`));
    const hp = units.reduce((sum, unit) => sum + unit.hp, 0);
    const maxHp = units.reduce((sum, unit) => sum + unit.maxHp, 0);
    root.append(el("p", "muted-copy", `總生命值 ${hp} / ${maxHp}`));
    root.append(el("p", "muted-copy", units.some(unit => unit.state === "moving") ? "狀態：移動中" : "狀態：待命"));
  }

  function renderBuilding(world, building) {
    const resources = getResourceDefinitions();
    root.append(el("p", "inspector-title", building.label));
    const used = Math.floor(inventoryTotal(building.inventory) + building.reservedIncoming);
    root.append(el("p", "muted-copy", `等級 ${building.level} · 品質 ${building.quality.toFixed(2)}`));
    const meter = el("div", "capacity-meter");
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", String(building.capacity));
    meter.setAttribute("aria-valuenow", String(used));
    meter.setAttribute("aria-label", "庫存容量");
    const fill = el("span", "capacity-fill");
    fill.style.width = `${Math.min(100, (used / building.capacity) * 100)}%`;
    meter.append(fill);
    root.append(meter, el("p", "muted-copy", `庫存 ${used} / ${building.capacity}`));

    root.append(el("p", "sub-label", "獨立庫存"));
    const entries = Object.entries(building.inventory).filter(([, amount]) => amount > 0.001);
    if (entries.length) {
      for (const [resource, amount] of entries) {
        const line = el("p", "inventory-line");
        line.append(el("span", "", resources[resource]?.label || resource), el("strong", "", formatAmount(amount)));
        root.append(line);
      }
    } else {
      root.append(el("p", "muted-copy", "目前沒有庫存。"));
    }
    if (EXTRACTORS.includes(building.type)) {
      const label = building.type === "metalMine" ? "礦點採集" : "地表開採";
      root.append(el("p", building.blockedReason ? "status-line warn" : "status-line", `${label}：${building.blockedReason || "正常運作中。"}`));
    }
    if (building.type === "factory") renderFactory(building);
  }

  function renderFactory(building) {
    const recipes = getRecipeDefinitions();
    const allocated = building.jobs.reduce((sum, job) => sum + job.allocation, 0);
    root.append(el("p", "sub-label", `生產排程（已分配 ${allocated}%）`));
    const act = (fn) => () => { fn(); onWorldChange(); refresh(true); };
    for (const job of building.jobs) {
      const recipe = recipes[job.recipeId];
      if (!recipe) continue;
      const row = el("div", "job-row");
      const info = el("div", "job-info");
      info.append(el("strong", "", recipe.label));
      info.append(el("small", "", `${job.allocation}% · ${JOB_STATES[job.state] || job.state} · ${Math.floor(job.progress / recipe.duration * 100)}%`));
      const controls = el("div", "job-controls");
      const minus = el("button", "tiny-button", "−");
      const plus = el("button", "tiny-button", "+");
      const remove = el("button", "tiny-button danger", "×");
      minus.type = plus.type = remove.type = "button";
      minus.setAttribute("aria-label", `降低${recipe.label}產能`);
      plus.setAttribute("aria-label", `提高${recipe.label}產能`);
      remove.setAttribute("aria-label", `移除${recipe.label}`);
      minus.addEventListener("click", act(() => adjustProductionAllocation(getWorld(), building.id, job.recipeId, -10)));
      plus.addEventListener("click", act(() => adjustProductionAllocation(getWorld(), building.id, job.recipeId, 10)));
      remove.addEventListener("click", act(() => removeProductionJob(getWorld(), building.id, job.recipeId)));
      controls.append(minus, plus, remove);
      row.append(info, controls);
      root.append(row);
    }
    const select = el("select", "field-control");
    select.setAttribute("aria-label", "新增配方");
    for (const recipe of Object.values(recipes)) {
      if (building.jobs.some(job => job.recipeId === recipe.id)) continue;
      const option = el("option", "", recipe.label);
      option.value = recipe.id;
      select.append(option);
    }
    const add = el("button", "small-button full-width", "加入生產排程");
    add.type = "button";
    add.disabled = !select.options.length;
    add.addEventListener("click", () => {
      const result = addProductionJob(getWorld(), building.id, select.value);
      if (!result.ok) notify(result.reason);
      onWorldChange();
      refresh(true);
    });
    root.append(el("p", "sub-label", "新增配方"), select, add);
  }

  function refreshTransfer(world, source, force) {
    const destinations = source ? world.structures.filter(item => item.owner === "player" && item.id !== source.id) : [];
    if (!source || !destinations.length) {
      transferSection.hidden = true;
      transferSignature = "";
      return;
    }
    const available = Object.entries(source.inventory).filter(([, amount]) => amount >= 1).map(([resource]) => resource);
    const signature = JSON.stringify([source.id, destinations.map(item => item.id), available]);
    if (!force && signature === transferSignature && !transferSection.hidden) return;
    if (!force && transferSection.contains(document.activeElement) && signature !== transferSignature) return;
    transferSignature = signature;
    transferSection.hidden = false;
    renderTransfer(source, destinations, available);
  }

  function renderTransfer(source, destinations, available) {
    const resources = getResourceDefinitions();
    transferForm.replaceChildren();
    const to = el("select", "field-control");
    to.id = "transfer-to";
    for (const destination of destinations) {
      const option = el("option", "", `${destination.label} (${destination.x}, ${destination.y})`);
      option.value = destination.id;
      to.append(option);
    }
    const what = el("select", "field-control");
    what.id = "transfer-resource";
    for (const resource of available) {
      const option = el("option", "", `${resources[resource]?.label || resource}（${Math.floor(source.inventory[resource])}）`);
      option.value = resource;
      what.append(option);
    }
    const amount = el("input", "field-control");
    amount.id = "transfer-amount";
    amount.type = "number"; amount.min = "1"; amount.step = "1"; amount.inputMode = "numeric";
    const setDefault = () => { amount.value = what.value ? String(Math.min(10, Math.floor(source.inventory[what.value] || 1))) : "1"; };
    what.addEventListener("change", setDefault);
    setDefault();
    const submit = el("button", "small-button full-width", "建立運輸訂單");
    submit.type = "button";
    submit.disabled = !available.length;
    submit.addEventListener("click", () => {
      const result = createTransferOrder(getWorld(), source.id, to.value, what.value, amount.value);
      notify(result.ok ? "物資已裝載，運輸途中。" : result.reason);
      onWorldChange();
      refresh(true);
    });
    const label = (text, forId) => { const l = el("label", "field-label", text); l.htmlFor = forId; return l; };
    transferForm.append(
      label("目的地", "transfer-to"), to, label("資源", "transfer-resource"), what, label("數量", "transfer-amount"), amount,
      submit, el("p", "muted-copy", "物資會先從來源扣除，抵達後才加入目的地庫存。")
    );
  }

  return { refresh };
}
