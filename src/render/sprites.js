// 建築與資源點的向量繪製。外觀由建築定義的 look 決定，新增建築只需指定既有外觀或補一個函式。
import { BUILDING_DEFINITIONS } from "../simulation/economy.js";

export const PALETTE = {
  ink: "#12171a", steel: "#8f9993", plate: "#2f3836", hazard: "#e2b53a", signal: "#ee6a2c",
  player: "#e8a23c", enemy: "#c8553f", neutral: "#a39f92", selection: "#fff0c4"
};

function slab(ctx, left, top, s, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(left, top, s, s);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, s, s);
}

const line = (ctx, width, color, points) => {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
};
const rect = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

const DETAIL = {
  hq(ctx, { cx, cy, s }) {
    rect(ctx, "#303a3e", cx - s * 0.27, cy - s * 0.24, s * 0.54, s * 0.52);
    rect(ctx, PALETTE.hazard, cx - s * 0.31, cy - s * 0.29, s * 0.62, s * 0.1);
    rect(ctx, "#e9e2d0", cx - s * 0.035, cy - s * 0.42, s * 0.07, s * 0.2);
    rect(ctx, "#e9e2d0", cx + s * 0.18, cy - s * 0.12, s * 0.06, s * 0.18);
  },
  factory(ctx, { left, top, s }) {
    rect(ctx, "#252d30", left + s * 0.12, top + s * 0.28, s * 0.76, s * 0.52);
    for (const x of [0.2, 0.42, 0.64]) rect(ctx, "#b5b5a9", left + s * x, top + s * 0.17, s * 0.13, s * 0.12);
    rect(ctx, PALETTE.hazard, left + s * 0.72, top - s * 0.12, s * 0.13, s * 0.4);
    rect(ctx, PALETTE.ink, left + s * 0.75, top - s * 0.16, s * 0.2, s * 0.08);
  },
  warehouse(ctx, { left, top, s }) {
    rect(ctx, "#343e42", left + s * 0.1, top + s * 0.2, s * 0.8, s * 0.58);
    for (let i = 1; i <= 3; i++) line(ctx, 1, "#aeb6b4", [[left + s * (0.1 + i * 0.2), top + s * 0.22], [left + s * (0.1 + i * 0.2), top + s * 0.75]]);
  },
  mine(ctx, { cx, cy, s, tile }) {
    const w = Math.max(2, tile * 0.075);
    line(ctx, w, "#22292c", [[cx - s * 0.22, cy + s * 0.34], [cx - s * 0.1, cy - s * 0.25], [cx + s * 0.1, cy - s * 0.25], [cx + s * 0.22, cy + s * 0.34]]);
    line(ctx, w, "#22292c", [[cx - s * 0.3, cy - s * 0.25], [cx + s * 0.3, cy - s * 0.25]]);
    rect(ctx, "#d6a24f", cx - s * 0.06, cy - s * 0.34, s * 0.12, s * 0.13);
  },
  surface(ctx, { cx, cy, left, top, s, tile }) {
    const w = Math.max(2, tile * 0.07);
    line(ctx, w, "#252c2f", [[cx + s * 0.2, top + s * 0.14], [cx + s * 0.02, top + s * 0.78]]);
    line(ctx, w, "#252c2f", [[cx + s * 0.2, top + s * 0.14], [cx + s * 0.38, top + s * 0.78]]);
    rect(ctx, "#171d20", cx - s * 0.02, top + s * 0.2, s * 0.44, s * 0.08);
    rect(ctx, "#c69a62", left + s * 0.1, top + s * 0.5, s * 0.34, s * 0.07);
    rect(ctx, "#c69a62", left + s * 0.1, top + s * 0.63, s * 0.34, s * 0.07);
    rect(ctx, "#aab6bd", left + s * 0.12, top + s * 0.2, s * 0.22, s * 0.2);
  },
  refinery(ctx, { cx, cy, left, top, s, tile }) {
    rect(ctx, "#2a3033", left + s * 0.12, top + s * 0.45, s * 0.76, s * 0.4);
    ctx.fillStyle = "#c8a0d0";
    ctx.beginPath(); ctx.arc(cx - s * 0.2, top + s * 0.38, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 0.2, top + s * 0.38, s * 0.16, 0, Math.PI * 2); ctx.fill();
    line(ctx, Math.max(1.5, tile * 0.05), "#1b2124", [[cx - s * 0.2, top + s * 0.5], [cx + s * 0.2, top + s * 0.5]]);
  },
  plant(ctx, { cx, left, top, s }) {
    rect(ctx, "#2a3033", left + s * 0.1, top + s * 0.5, s * 0.8, s * 0.35);
    ctx.fillStyle = "#c9ccc4";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.28, top + s * 0.5); ctx.lineTo(cx - s * 0.18, top + s * 0.14);
    ctx.lineTo(cx + s * 0.18, top + s * 0.14); ctx.lineTo(cx + s * 0.28, top + s * 0.5);
    ctx.closePath(); ctx.fill();
    rect(ctx, PALETTE.signal, left + s * 0.18, top + s * 0.6, s * 0.14, s * 0.14);
  },
  nuclear(ctx, { cx, cy, left, top, s, tile }) {
    rect(ctx, "#2a3033", left + s * 0.08, top + s * 0.62, s * 0.84, s * 0.26);
    ctx.fillStyle = "#cfd5cf";
    ctx.beginPath(); ctx.arc(cx, top + s * 0.62, s * 0.34, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#8fe3a0";
    ctx.beginPath(); ctx.arc(cx, top + s * 0.5, s * 0.07, 0, Math.PI * 2); ctx.fill();
    line(ctx, Math.max(1, tile * 0.04), "#2a3033", [[cx, top + s * 0.3], [cx, top + s * 0.62]]);
  },
  lab(ctx, { cx, left, top, s, tile }) {
    rect(ctx, "#2f383b", left + s * 0.12, top + s * 0.45, s * 0.76, s * 0.4);
    line(ctx, Math.max(1.5, tile * 0.05), "#d7dcd4", [[cx - s * 0.25, top + s * 0.4], [cx, top + s * 0.1], [cx + s * 0.25, top + s * 0.4]]);
    rect(ctx, "#8fe3a0", cx - s * 0.04, top + s * 0.06, s * 0.08, s * 0.08);
  },
  silo(ctx, { cx, left, top, s }) {
    rect(ctx, "#2a3033", left + s * 0.14, top + s * 0.3, s * 0.72, s * 0.52);
    ctx.fillStyle = "#e0b030";
    ctx.beginPath(); ctx.moveTo(cx, top + s * 0.06); ctx.lineTo(cx + s * 0.12, top + s * 0.34); ctx.lineTo(cx - s * 0.12, top + s * 0.34); ctx.closePath(); ctx.fill();
    rect(ctx, "#ee6a2c", left + s * 0.2, top + s * 0.7, s * 0.6, s * 0.06);
  },
  hangar(ctx, { cx, left, top, s, tile }) {
    ctx.fillStyle = "#2f383b";
    ctx.beginPath(); ctx.moveTo(left + s * 0.08, top + s * 0.82); ctx.lineTo(left + s * 0.08, top + s * 0.45);
    ctx.quadraticCurveTo(cx, top + s * 0.02, left + s * 0.92, top + s * 0.45); ctx.lineTo(left + s * 0.92, top + s * 0.82); ctx.closePath(); ctx.fill();
    rect(ctx, "#171d20", cx - s * 0.2, top + s * 0.55, s * 0.4, s * 0.27);
    line(ctx, Math.max(1, tile * 0.04), "#aeb6b4", [[cx, top + s * 0.55], [cx, top + s * 0.82]]);
  },
  flame(ctx, { cx, cy, s }) {
    ctx.fillStyle = "#f08a3a";
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.34); ctx.quadraticCurveTo(cx + s * 0.3, cy, cx, cy + s * 0.3); ctx.quadraticCurveTo(cx - s * 0.3, cy, cx, cy - s * 0.34); ctx.fill();
    rect(ctx, "#f5d27a", cx - s * 0.07, cy - s * 0.02, s * 0.14, s * 0.22);
  },
  bolt(ctx, { cx, cy, s, tile }) {
    line(ctx, Math.max(2, tile * 0.08), "#b6ecf8", [[cx + s * 0.1, cy - s * 0.34], [cx - s * 0.12, cy + s * 0.02], [cx + s * 0.1, cy + s * 0.02], [cx - s * 0.1, cy + s * 0.34]]);
  },
  wire(ctx, { left, top, s, tile }) {
    line(ctx, Math.max(1.5, tile * 0.06), "#d7dcd4", [[left + s * 0.08, top + s * 0.7], [left + s * 0.28, top + s * 0.25], [left + s * 0.48, top + s * 0.7], [left + s * 0.68, top + s * 0.25], [left + s * 0.92, top + s * 0.7]]);
  },
  emp(ctx, { cx, cy, s, tile }) {
    ctx.strokeStyle = "#d0b8f0"; ctx.lineWidth = Math.max(1.5, tile * 0.05);
    for (const r of [0.12, 0.24, 0.36]) { ctx.beginPath(); ctx.arc(cx, cy, s * r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#d0b8f0"; ctx.beginPath(); ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2); ctx.fill();
  },
  turret(ctx, { cx, cy, s, tile }) {
    ctx.fillStyle = "#2a3033"; ctx.beginPath(); ctx.arc(cx, cy + s * 0.04, s * 0.27, 0, Math.PI * 2); ctx.fill();
    line(ctx, Math.max(2.5, tile * 0.1), "#d7dcd4", [[cx, cy], [cx + s * 0.34, cy - s * 0.3]]);
  },
  crossbow(ctx, { cx, cy, s, tile }) {
    ctx.strokeStyle = "#e0c58a"; ctx.lineWidth = Math.max(2, tile * 0.07);
    ctx.beginPath(); ctx.arc(cx - s * 0.18, cy, s * 0.36, -Math.PI / 2.3, Math.PI / 2.3); ctx.stroke();
    line(ctx, Math.max(1, tile * 0.04), "#d7dcd4", [[cx - s * 0.18, cy - s * 0.3], [cx - s * 0.18, cy + s * 0.3]]);
    line(ctx, Math.max(1.5, tile * 0.05), "#d7dcd4", [[cx - s * 0.18, cy], [cx + s * 0.36, cy]]);
  },
  aa(ctx, { cx, cy, s, tile }) {
    rect(ctx, "#2a3033", cx - s * 0.3, cy + s * 0.12, s * 0.6, s * 0.2);
    const w = Math.max(2.5, tile * 0.09);
    line(ctx, w, "#e0836a", [[cx - s * 0.12, cy + s * 0.12], [cx - s * 0.3, cy - s * 0.3]]);
    line(ctx, w, "#e0836a", [[cx + s * 0.12, cy + s * 0.12], [cx + s * 0.3, cy - s * 0.3]]);
  },
  airfield(ctx, { cx, cy, left, top, s, tile }) {
    rect(ctx, "#2a3033", left + s * 0.06, cy - s * 0.12, s * 0.88, s * 0.24);
    ctx.setLineDash([tile * 0.1, tile * 0.08]);
    line(ctx, Math.max(1, tile * 0.04), "#e9e2d0", [[left + s * 0.1, cy], [left + s * 0.9, cy]]);
    ctx.setLineDash([]);
    line(ctx, Math.max(2, tile * 0.07), "#a8c8e8", [[cx - s * 0.2, top + s * 0.18], [cx + s * 0.2, top + s * 0.18]]);
  }
};

/** quality.details 為 false 時只畫輪廓色塊，省下大量路徑繪製。 */
export function drawStructure(ctx, structure, geometry, ownerColor, selected, quality) {
  const { cx, cy, tile } = geometry;
  const definition = BUILDING_DEFINITIONS[structure.type];
  const look = definition?.look ?? structure.type;
  const s = tile * (structure.type === "hq" ? 0.88 : 0.78);
  const left = cx - s / 2;
  const top = cy - s / 2;
  const frame = { cx, cy, s, left, top, tile };

  if (quality.shadows) {
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fillRect(left + tile * 0.08, top + tile * 0.12, s, s);
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(left - tile * 0.04, top - tile * 0.04, s + tile * 0.08, s + tile * 0.08);
  ctx.strokeStyle = selected ? PALETTE.selection : "#697276";
  ctx.lineWidth = selected ? 2.5 : 1;
  ctx.strokeRect(left - tile * 0.04, top - tile * 0.04, s + tile * 0.08, s + tile * 0.08);

  if (structure.type === "outpost") {
    ctx.fillStyle = ownerColor;
    ctx.beginPath();
    ctx.moveTo(cx, top - tile * 0.08); ctx.lineTo(left + s + tile * 0.08, cy);
    ctx.lineTo(cx, top + s + tile * 0.08); ctx.lineTo(left - tile * 0.08, cy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(cx - tile * 0.08, cy - tile * 0.08, tile * 0.16, tile * 0.16);
  } else {
    slab(ctx, left, top, s, ownerColor, "#121719");
    if (quality.details) {
      ctx.strokeStyle = "rgba(15,20,22,.62)"; ctx.lineWidth = Math.max(1, tile * 0.035);
      ctx.beginPath();
      ctx.moveTo(left + s * 0.12, top + s * 0.72); ctx.lineTo(left + s * 0.88, top + s * 0.72);
      ctx.moveTo(left + s * 0.18, top + s * 0.12); ctx.lineTo(left + s * 0.18, top + s * 0.66);
      ctx.stroke();
      DETAIL[look]?.(ctx, frame);
      if (definition?.glyph && structure.type !== "hq" && tile >= 22) {
        ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.fillRect(left + s * 0.58, top + s * 0.62, s * 0.4, s * 0.36);
        ctx.fillStyle = "#f1ecdf"; ctx.font = `800 ${Math.max(8, s * 0.3)}px "Noto Sans TC", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(definition.glyph, left + s * 0.78, top + s * 0.81);
      }
    }
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, tile * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = "#f3d28e"; ctx.lineWidth = 2;
    ctx.setLineDash([tile * 0.12, tile * 0.08]); ctx.stroke(); ctx.setLineDash([]);
  }
}

export function drawResourceNode(ctx, node, definition, geometry, quality, showLabel) {
  const { cx, cy, tile } = geometry;
  const radius = Math.max(5, tile * 0.34);
  ctx.globalAlpha = Math.max(0.35, node.amount / node.maxAmount);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(cx - radius * 1.2, cy - radius * 0.8, radius * 2.4, radius * 1.6);
  ctx.strokeStyle = definition.color; ctx.lineWidth = Math.max(2, tile * 0.08);
  ctx.strokeRect(cx - radius * 1.2, cy - radius * 0.8, radius * 2.4, radius * 1.6);
  if (quality.details) {
    ctx.fillStyle = definition.color;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.72 + i * radius * 0.62, cy + radius * 0.35);
      ctx.lineTo(cx - radius * 0.45 + i * radius * 0.62, cy - radius * 0.35);
      ctx.lineTo(cx - radius * 0.12 + i * radius * 0.62, cy + radius * 0.35);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (showLabel) {
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `900 ${Math.max(8, tile * 0.32)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(node.type === "commonMetal" ? "M" : "R", cx, cy);
  }
}
