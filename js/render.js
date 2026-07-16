/**
 * Dibujo en canvas: bloques retro biselados, tablero y previews.
 * El tamaño de celda se deriva del canvas para que 1 bloque = 1 celda exacta.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Render = {};

  /** Fija CSS al tamaño interno del canvas (evita estirar y “cuadrados raros”). */
  Render.fitCanvas = function fitCanvas(canvas) {
    if (!canvas) return;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    canvas.style.imageRendering = "pixelated";
  };

  /** Tamaño de celda entero que cabe en el canvas (COLS x ROWS). */
  Render.cellSize = function cellSize(canvas, preferred) {
    if (!canvas) return preferred || 30;
    const byW = Math.floor(canvas.width / T.COLS);
    const byH = Math.floor(canvas.height / T.ROWS);
    let s = Math.min(byW, byH);
    if (preferred && preferred <= s) s = preferred;
    return Math.max(8, s);
  };

  /** Oscurece o aclara un hex. amount: -1..1 */
  Render.shade = function shade(hex, amount) {
    if (!hex || !hex.startsWith("#")) return hex || "#888";
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
   * Bloque retro: siempre dentro de [x*size, (x+1)*size).
   */
  Render.drawBlock = function drawBlock(ctx, x, y, color, size, ghost) {
    const gap = size >= 18 ? 1 : 0;
    const px = x * size + gap;
    const py = y * size + gap;
    const s = size - gap * 2;
    if (s <= 0) return;

    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      ctx.restore();
      return;
    }

    const bevel = Math.max(1, Math.min(Math.floor(s * 0.15), Math.floor((s - 1) / 2)));

    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);

    // bisel interior (no se sale de la celda)
    ctx.fillStyle = Render.shade(color, 0.32);
    ctx.fillRect(px, py, s, bevel);
    ctx.fillRect(px, py, bevel, s);

    ctx.fillStyle = Render.shade(color, -0.32);
    ctx.fillRect(px, py + s - bevel, s, bevel);
    ctx.fillRect(px + s - bevel, py, bevel, s);

    if (bevel >= 2 && s > 6) {
      ctx.fillStyle = Render.shade(color, 0.48);
      ctx.fillRect(px + bevel, py + bevel, bevel, bevel);
    }
  };

  Render.drawField = function drawField(ctx, canvas, grid, piece, block, showGhost, opts) {
    var withFx = opts && opts.withFx;
    var dead = opts && opts.dead;
    var koLabel = (opts && opts.koLabel) || "KO";
    var E = T.Engine;

    Render.fitCanvas(canvas);
    block = Render.cellSize(canvas, block);

    var boardW = T.COLS * block;
    var boardH = T.ROWS * block;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo
    ctx.fillStyle = "#0c0c08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Centrar tablero si sobra margen
    var ox = Math.floor((canvas.width - boardW) / 2);
    var oy = Math.floor((canvas.height - boardH) / 2);
    ctx.save();
    ctx.translate(ox, oy);

    // Rejilla
    ctx.strokeStyle = T.COLORS.GRID || "rgba(90, 90, 55, 0.22)";
    ctx.lineWidth = 1;
    for (var c = 0; c <= T.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * block + 0.5, 0);
      ctx.lineTo(c * block + 0.5, boardH);
      ctx.stroke();
    }
    for (var r = 0; r <= T.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * block + 0.5);
      ctx.lineTo(boardW, r * block + 0.5);
      ctx.stroke();
    }

    // Bloques fijados
    if (grid) {
      for (var r = 0; r < T.ROWS; r++) {
        for (var c = 0; c < T.COLS; c++) {
          var t = grid[r][c];
          if (t) Render.drawBlock(ctx, c, r, T.COLORS[t] || T.COLORS.G, block);
        }
      }
    }

    // Pieza activa + ghost
    if (piece && !dead) {
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

    if (withFx && T.FX) {
      ctx.save();
      // FX se dibuja en coords de bloque; ya estamos en ox,oy
      T.FX.draw(ctx);
      ctx.restore();
    }

    // Overlay KO
    if (dead) {
      ctx.fillStyle = "rgba(8, 6, 4, 0.55)";
      ctx.fillRect(0, 0, boardW, boardH);
      ctx.fillStyle = "#d06058";
      ctx.font = Math.max(10, Math.floor(block * 0.7)) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(koLabel, boardW / 2, boardH / 2 - block);
      ctx.fillStyle = "#a0a070";
      ctx.font = Math.max(8, Math.floor(block * 0.4)) + "px 'Press Start 2P', monospace";
      ctx.fillText("ESPERA REVIVIR", boardW / 2, boardH / 2 + block * 0.6);
    }

    ctx.restore();
  };

  Render.drawMini = function drawMini(ctx, canvas, type, dimmed) {
    Render.fitCanvas(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0c0c08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    var matrix = T.SHAPES[type][0];
    var rows = matrix.length;
    var cols = matrix[0].length;
    var pad = 6;
    var size = Math.floor(
      Math.min((canvas.width - pad) / Math.max(cols, 4), (canvas.height - pad) / Math.max(rows, 2))
    );
    size = Math.max(6, Math.min(size, 24));
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
