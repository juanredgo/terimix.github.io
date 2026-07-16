/**
 * IA del bot: evaluación de tablero y mejor colocación.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Bot = {};

  Bot.evaluateGrid = function evaluateGrid(grid) {
    const heights = Array(T.COLS).fill(0);
    let holes = 0;
    let aggregate = 0;
    let bumpiness = 0;
    let completed = 0;

    for (let c = 0; c < T.COLS; c++) {
      let found = false;
      let h = 0;
      for (let r = 0; r < T.ROWS; r++) {
        if (grid[r][c]) {
          if (!found) {
            found = true;
            h = T.ROWS - r;
          }
        } else if (found) {
          holes++;
        }
      }
      heights[c] = h;
      aggregate += h;
    }
    for (let c = 0; c < T.COLS - 1; c++) {
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }
    for (let r = 0; r < T.ROWS; r++) {
      if (grid[r].every((cell) => cell !== null)) completed++;
    }
    return completed * 760 - aggregate * 18 - holes * 95 - bumpiness * 12 - Math.max(...heights) * 8;
  };

  Bot.findBestMove = function findBestMove(grid, type, cfg) {
    const E = T.Engine;
    const candidates = [];
    const maxRot = type === "O" ? 1 : 4;
    for (let rot = 0; rot < maxRot; rot++) {
      for (let x = -2; x < T.COLS; x++) {
        const piece = { type, rotation: rot, x, y: type === "I" ? -1 : 0 };
        if (E.collides(grid, piece)) continue;
        while (!E.collides(grid, piece, 0, 1)) piece.y++;
        const g2 = E.cloneGrid(grid);
        const topOut = E.lockOntoGrid(g2, piece);
        if (topOut) continue;
        const { cleared } = E.clearFullLines(g2);
        let score = Bot.evaluateGrid(g2) + cleared * 120;
        score += (Math.random() - 0.5) * cfg.noise * 2;
        candidates.push({ rot, x, score, cleared, y: piece.y });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    if (Math.random() < cfg.mistakeChance && candidates.length > 3) {
      const idx = 1 + Math.floor(Math.random() * Math.min(5, candidates.length - 1));
      return candidates[idx];
    }
    return candidates[0];
  };

  Bot.randRange = function randRange(a, b) {
    return a + Math.random() * (b - a);
  };

  T.Bot = Bot;
})(window.Tetris);
