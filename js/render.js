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
    // 1px de hueco entre celdas para que el bloque coincida con la rejilla
    const pad = size >= 20 ? 1 : 0.5;
    const px = Math.floor(x * size + pad);
    const py = Math.floor(y * size + pad);
    const s = Math.max(1, Math.floor(size - pad * 2));

    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(size / 16));
      ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      ctx.restore();
      return;
    }

    const bevel = Math.max(1, Math.min(Math.floor(s * 0.16), Math.floor(s / 3)));

    // cara principal (nunca más grande que la celda)
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);

    // borde claro: arriba y izquierda
    ctx.fillStyle = Render.shade(color, 0.35);
    ctx.fillRect(px, py, s, bevel);
    ctx.fillRect(px, py, bevel, s);

    // borde oscuro: abajo y derecha
    ctx.fillStyle = Render.shade(color, -0.35);
    ctx.fillRect(px, py + s - bevel, s, bevel);
    ctx.fillRect(px + s - bevel, py, bevel, s);

    // esquina interior (brillo)
    if (bevel >= 2) {
      ctx.fillStyle = Render.shade(color, 0.5);
      ctx.fillRect(px + bevel, py + bevel, Math.max(1, bevel - 1), Math.max(1, bevel - 1));
    }
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
    // Tamaño de celda exacto para que la pieza quepa sin verse “hinchada”
    var pad = 8;
    var size = Math.floor(Math.min((canvas.width - pad) / Math.max(cols, 4), (canvas.height - pad) / Math.max(rows, 4)));
    size = Math.max(8, Math.min(size, 22));
    var totalW = cols * size;
    var totalH = rows * size;
    ctx.save();
    ctx.translate(Math.floor((canvas.width - totalW) / 2), Math.floor((canvas.height - totalH) / 2));
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
