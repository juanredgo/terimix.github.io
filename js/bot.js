/**
 * IA del bot: evaluación, mejor jugada y driver de ejecución (versus / auto / boss).
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

  /**
   * Driver reutilizable: piensa → rota/mueve → hard drop → lock.
   * api: {
   *   getPiece(), getGrid(),
   *   tryMove(dx,dy) -> bool,
   *   tryRotateCW() -> kickIndex >=0 or -1,
   *   hardDropAndLock(),
   *   gravityDrop() optional single step down,
   *   onAfterLock() optional,
   *   isAlive() -> bool
   * }
   */
  Bot.createDriver = function createDriver() {
    return {
      plan: null,
      phase: "think",
      thinkTimer: 0,
      moveTimer: 0,
      steps: 0,
      dropAcc: 0,

      reset: function (cfg) {
        this.plan = null;
        this.phase = "think";
        this.thinkTimer = cfg ? Bot.randRange(cfg.thinkMs[0], cfg.thinkMs[1]) : 0;
        this.moveTimer = 0;
        this.steps = 0;
        this.dropAcc = 0;
      },

      /**
       * @returns {"locked"|"thinking"|"moving"|null}
       */
      tick: function (dt, cfg, api) {
        if (!api || !api.isAlive()) return null;
        const piece = api.getPiece();
        if (!piece) return null;

        // Gravedad suave del bot
        if (api.gravityStep) {
          this.dropAcc += dt;
          const grounded = api.isGrounded && api.isGrounded();
          if (grounded) {
            // lock delay lo maneja el caller si quiere; aquí solo ejecuta plan
          } else {
            while (this.dropAcc >= cfg.dropInterval) {
              this.dropAcc -= cfg.dropInterval;
              api.gravityStep();
            }
          }
        }

        if (this.phase === "think") {
          this.thinkTimer -= dt;
          if (this.thinkTimer <= 0) {
            this.plan = Bot.findBestMove(api.getGrid(), piece.type, cfg);
            this.phase = "execute";
            this.moveTimer = 0;
            this.steps = 0;
          }
          return "thinking";
        }

        if (this.phase === "execute") {
          this.moveTimer -= dt;
          if (this.moveTimer > 0) return "moving";
          this.moveTimer = cfg.moveMs;
          this.steps++;

          const forceDrop = () => {
            api.hardDropAndLock();
            this.reset(cfg);
            if (api.onAfterLock) api.onAfterLock();
            return "locked";
          };

          if (!this.plan || this.steps > 40) return forceDrop();

          if (piece.rotation !== this.plan.rot) {
            const kick = api.tryRotateCW();
            if (kick < 0) this.steps = 40;
            return "moving";
          }
          if (piece.x < this.plan.x) {
            if (!api.tryMove(1, 0)) this.plan.x = piece.x;
            return "moving";
          }
          if (piece.x > this.plan.x) {
            if (!api.tryMove(-1, 0)) this.plan.x = piece.x;
            return "moving";
          }
          return forceDrop();
        }

        return null;
      },
    };
  };

  T.Bot = Bot;
})(window.Tetris);
