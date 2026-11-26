const COLORS = {
  background: "#091923", grid: "rgba(160, 208, 226, 0.10)",
  plain: "#122b35", rough: "#1b3540", water: "#102b43",
  player: "#83d9f3", enemy: "#e77d79", neutral: "#d4b978"
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let pixelRatio = 1;
  let geometry = { cell: 24, offsetX: 0, offsetY: 0 };

  function setPixelRatio(value) { pixelRatio = value; }

  function draw(world) {
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    const cell = Math.floor(Math.min(width / world.width, height / world.height));
    const mapWidth = cell * world.width;
    const mapHeight = cell * world.height;
    const offsetX = Math.floor((width - mapWidth) / 2);
    const offsetY = Math.floor((height - mapHeight) / 2);
    geometry = { cell, offsetX, offsetY };

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.cells[y][x];
        ctx.fillStyle = tile.terrain === "water" ? COLORS.water : tile.terrain === "rough" ? COLORS.rough : COLORS.plain;
        ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
        if (tile.owner === "player") {
          ctx.fillStyle = "rgba(88, 190, 222, 0.14)";
          ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
        }
        ctx.strokeStyle = COLORS.grid;
        ctx.strokeRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
      }
    }
    for (const structure of world.structures) drawStructure(structure, cell, offsetX, offsetY);
    for (const unit of world.units) drawUnit(unit, world.selectedUnitId === unit.id, cell, offsetX, offsetY);
  }

  function drawStructure(structure, cell, ox, oy) {
    const cx = ox + (structure.x + 0.5) * cell;
    const cy = oy + (structure.y + 0.5) * cell;
    const color = structure.owner === "player" ? COLORS.player : structure.owner === "enemy" ? COLORS.enemy : COLORS.neutral;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#07131d";
    ctx.lineWidth = 2;
    if (structure.kind === "hq") {
      ctx.fillRect(cx - cell * 0.38, cy - cell * 0.38, cell * 0.76, cell * 0.76);
      ctx.strokeRect(cx - cell * 0.38, cy - cell * 0.38, cell * 0.76, cell * 0.76);
      ctx.fillStyle = "#07131d";
      ctx.font = "bold " + Math.max(9, cell * 0.48) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", cx, cy);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.31, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawUnit(unit, selected, cell, ox, oy) {
    const cx = ox + (unit.x + 0.5) * cell;
    const cy = oy + (unit.y + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (selected ? 0.34 : 0.27), 0, Math.PI * 2);
    ctx.fillStyle = COLORS.player;
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#ffffff" : "#173b4b";
    ctx.stroke();
    if (selected) {
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left - geometry.offsetX) / geometry.cell),
      y: Math.floor((event.clientY - rect.top - geometry.offsetY) / geometry.cell)
    };
  }
  return { draw, pointerToCell, setPixelRatio };
}
