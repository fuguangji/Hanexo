// 建築與資源點的向量繪製。每種建築是一個獨立函式，新增建築不必改動渲染主流程。
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

const DETAIL = {
  hq(ctx, { cx, cy, s }) {
    ctx.fillStyle = "#303a3e"; ctx.fillRect(cx - s * 0.27, cy - s * 0.24, s * 0.54, s * 0.52);
    ctx.fillStyle = PALETTE.hazard; ctx.fillRect(cx - s * 0.31, cy - s * 0.29, s * 0.62, s * 0.1);
    ctx.fillStyle = "#e9e2d0";
    ctx.fillRect(cx - s * 0.035, cy - s * 0.42, s * 0.07, s * 0.2);
    ctx.fillRect(cx + s * 0.18, cy - s * 0.12, s * 0.06, s * 0.18);
  },
  factory(ctx, { left, top, s }) {
    ctx.fillStyle = "#252d30"; ctx.fillRect(left + s * 0.12, top + s * 0.28, s * 0.76, s * 0.52);
    ctx.fillStyle = "#b5b5a9";
    for (const x of [0.2, 0.42, 0.64]) ctx.fillRect(left + s * x, top + s * 0.17, s * 0.13, s * 0.12);
    ctx.fillStyle = PALETTE.hazard; ctx.fillRect(left + s * 0.72, top - s * 0.12, s * 0.13, s * 0.4);
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(left + s * 0.75, top - s * 0.16, s * 0.2, s * 0.08);
  },
  warehouse(ctx, { left, top, s }) {
    ctx.fillStyle = "#343e42"; ctx.fillRect(left + s * 0.1, top + s * 0.2, s * 0.8, s * 0.58);
    ctx.strokeStyle = "#aeb6b4";
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) { ctx.moveTo(left + s * (0.1 + i * 0.2), top + s * 0.22); ctx.lineTo(left + s * (0.1 + i * 0.2), top + s * 0.75); }
    ctx.stroke();
  },
  metalMine(ctx, { cx, cy, s, tile }) {
    ctx.strokeStyle = "#22292c"; ctx.lineWidth = Math.max(2, tile * 0.075);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy + s * 0.34); ctx.lineTo(cx - s * 0.1, cy - s * 0.25);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.25); ctx.lineTo(cx + s * 0.22, cy + s * 0.34);
    ctx.moveTo(cx - s * 0.3, cy - s * 0.25); ctx.lineTo(cx + s * 0.3, cy - s * 0.25);
    ctx.stroke();
    ctx.fillStyle = "#d6a24f"; ctx.fillRect(cx - s * 0.06, cy - s * 0.34, s * 0.12, s * 0.13);
  },
  oilWell(ctx, { cx, cy, s, top, tile }) {
    ctx.strokeStyle = "#252c2f"; ctx.lineWidth = Math.max(2, tile * 0.075);
    ctx.beginPath();
    ctx.moveTo(cx, top + s * 0.12); ctx.lineTo(cx - s * 0.2, top + s * 0.78);
    ctx.moveTo(cx, top + s * 0.12); ctx.lineTo(cx + s * 0.2, top + s * 0.78);
    ctx.moveTo(cx - s * 0.28, top + s * 0.25); ctx.lineTo(cx + s * 0.28, top + s * 0.25);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(cx - s * 0.32, top + s * 0.18, s * 0.64, s * 0.09);
  },
  lumberCamp(ctx, { left, top, s }) {
    ctx.fillStyle = "#282f2e"; ctx.fillRect(left + s * 0.12, top + s * 0.18, s * 0.76, s * 0.48);
    ctx.fillStyle = "#c69a62";
    for (let i = 0; i < 3; i++) ctx.fillRect(left + s * 0.2, top + s * (0.24 + i * 0.13), s * 0.6, s * 0.055);
  },
  quarry(ctx, { cx, cy, s }) {
    ctx.fillStyle = "#30383b"; ctx.fillRect(cx - s * 0.22, cy - s * 0.22, s * 0.44, s * 0.48);
    ctx.fillStyle = "#d0d0c3"; ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.12);
    ctx.strokeStyle = "#20272a"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.14, cy - s * 0.1); ctx.lineTo(cx + s * 0.14, cy + s * 0.2);
    ctx.moveTo(cx + s * 0.14, cy - s * 0.1); ctx.lineTo(cx - s * 0.14, cy + s * 0.2);
    ctx.stroke();
  }
};

/** quality.details 為 false 時只畫輪廓色塊，省下大量路徑繪製。 */
export function drawStructure(ctx, structure, geometry, ownerColor, selected, quality) {
  const { cx, cy, tile } = geometry;
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
      DETAIL[structure.type]?.(ctx, frame);
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
    ctx.fillText(node.resource === "commonMetal" ? "M" : "R", cx, cy);
  }
}
