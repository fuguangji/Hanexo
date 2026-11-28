import { BUILDING_CATEGORIES, BUILDING_DEFINITIONS, BUILDING_ORDER, RESOURCE_DEFINITIONS } from "../simulation/economy.js";
import { el } from "./dom.js";

const costText = cost => Object.entries(cost).map(([resource, amount]) => `${RESOURCE_DEFINITIONS[resource]?.label || resource} ${amount}`).join(" · ") || "免費";

/** 依建築定義產生分類建造選單；之後只需更新「可負擔」與「選取中」狀態。 */
export function createBuildMenu({ root, onSelect }) {
  const buttons = new Map();
  root.replaceChildren();
  for (const category of BUILDING_CATEGORIES) {
    const types = BUILDING_ORDER.filter(type => BUILDING_DEFINITIONS[type].category === category.id);
    if (!types.length) continue;
    const group = el("details", "build-category");
    if (category.id === "extraction") group.open = true;
    const summary = el("summary");
    summary.append(el("span", "", category.label), el("small", "", `${types.length} 種`));
    const grid = el("div", "build-grid");
    for (const type of types) {
      const definition = BUILDING_DEFINITIONS[type];
      const button = el("button", "build-button");
      button.type = "button";
      button.dataset.build = type;
      button.setAttribute("aria-pressed", "false");
      const details = [definition.note, definition.power ? `用電 ${definition.power}` : null, definition.generator ? `發電 ${definition.generator.output}` : null]
        .filter(Boolean).join("　");
      button.title = details;
      button.append(el("span", "build-name", definition.label), el("small", "", costText(definition.cost)));
      button.addEventListener("click", () => onSelect(type));
      buttons.set(type, button);
      grid.append(button);
    }
    group.append(summary, grid);
    root.append(group);
  }

  return {
    refresh(hqInventory, activeType) {
      for (const [type, button] of buttons) {
        const affordable = Object.entries(BUILDING_DEFINITIONS[type].cost).every(([resource, amount]) => (hqInventory[resource] || 0) + 1e-9 >= amount);
        button.classList.toggle("active", type === activeType);
        button.classList.toggle("unaffordable", !affordable);
        button.setAttribute("aria-pressed", String(type === activeType));
      }
    }
  };
}
