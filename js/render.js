/**
 * Dibujo en canvas: bloques retro biselados, tablero y previews.
 * Estilo NES/Game Boy: bordes duros, sin gradientes suaves.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Render = {};

  /** Oscurece o aclara un hex. amount: -1..1 */
  Render.shade = function shade(hex, amount) {
    if (!hex.startsWith("#")) return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.min(255, Math.max(0, Math.round(r + 255 * amount)));
    g = Math.min(255, Math.max(0, Math.round(g + 255 * amount)));
    b = Math.min(255, Math.max(0, Math.round(b + 255 * amount)));
    return `rgb(${r},${g},${b})`;
  };

  /**
   * Bloque retro biselado: cara plana con borde claro arriba-izq
   * y borde oscuro abajo-der, como los Tetris de NES/GB.
   */
  Render.drawBlock = function drawBlock(ctx, x, y, color, size, ghost) {
    const pad = 1;
    const px = x * size + pad;
    const py = y * size + pad;
    const s = size - pad * 2;

    if (ghost) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
      ctx.globalAlpha = 1;
      return;
    }

    const bevel = Math.max(2, Math.floor(s * 0.18));

    // cara principal
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);

    // borde claro: arriba y izquierda
    ctx.fillStyle = Render.shade(color, 0.35);
    ctx.fillRect(px, py, s, bevel);          // top
    ctx.fillRect(px, py, bevel, s);          // left

    // borde oscuro: abajo y derecha
    ctx.fillStyle = Render.shade(color, -0.35);
    ctx.fillRect(px, py + s - bevel, s, bevel);  // bottom
    ctx.fillRect(px + s - bevel, py, bevel, s);  // right

    // esquina interior (brillo)
    ctx.fillStyle = Render.shade(color, 0.5);
    ctx.fillRect(px + bevel, py + bevel, bevel, bevel);
  };

  Render.drawField = function drawField(ctx, canvas, grid, piece, block, showGhost, opts) {
    var withFx = opts && opts.withFx;
    var E = T.Engine;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo oscuro del tablero
    ctx.fillStyle = "#0e0e06";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid con lineas sutiles
    ctx.strokeStyle = "rgba(74, 74, 46, 0.18)";
    ctx.lineWidth = 1;
    for (var c = 0; c <= T.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * block + 0.5, 0);
      ctx.lineTo(c * block + 0.5, T.ROWS * block);
      ctx.stroke();
    }
    for (var r = 0; r <= T.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * block + 0.5);
      ctx.lineTo(T.COLS * block, r * block + 0.5);
      ctx.stroke();
    }

    // Bloques fijados
    for (var r = 0; r < T.ROWS; r++) {
      for (var c = 0; c < T.COLS; c++) {
        var t = grid[r][c];
        if (t) Render.drawBlock(ctx, c, r, T.COLORS[t] || T.COLORS.G, block);
      }
    }

    // Pieza activa + ghost
    if (piece) {
      var matrix = E.getMatrix(piece);
      if (showGhost) {
        var gy = E.ghostY(grid, piece);
        for (var r = 0; r < matrix.length; r++) {
          for (var c = 0; c < matrix[r].length; c++) {
            if (!matrix[r][c]) continue;
            var x = piece.x + c;
            var y = gy + r;
            if (y >= 0) Render.drawBlock(ctx, x, y, T.COLORS[piece.type], block, true);
          }
        }
      }
      for (var r = 0; r < matrix.length; r++) {
        for (var c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          var x = piece.x + c;
          var y = piece.y + r;
          if (y >= 0) Render.drawBlock(ctx, x, y, T.COLORS[piece.type], block);
        }
      }
    }

    if (withFx && T.FX) T.FX.draw(ctx);
  };

  Render.drawMini = function drawMini(ctx, canvas, type, dimmed) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0e0e06";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    var matrix = T.SHAPES[type][0];
    var rows = matrix.length;
    var cols = matrix[0].length;
    var size = Math.min(22, Math.floor((canvas.width - 12) / Math.max(cols, 4)));
    var totalW = cols * size;
    var totalH = rows * size;
    ctx.save();
    ctx.translate((canvas.width - totalW) / 2, (canvas.height - totalH) / 2);
    if (dimmed) ctx.globalAlpha = 0.3;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!matrix[r][c]) continue;
        Render.drawBlock(ctx, c, r, T.COLORS[type], size);
      }
    }
    ctx.restore();
  };

  T.Render = Render;
})(window.Tetris);
