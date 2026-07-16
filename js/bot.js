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
    let wells = 0;

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
    // Pozos profundos (un solo hueco entre columnas altas) — castigan apilar a un lado
    for (let c = 0; c < T.COLS; c++) {
      const left = c === 0 ? T.ROWS : heights[c - 1];
      const right = c === T.COLS - 1 ? T.ROWS : heights[c + 1];
      const depth = Math.min(left, right) - heights[c];
      if (depth > 0) wells += depth;
    }
    for (let r = 0; r < T.ROWS; r++) {
      if (grid[r].every((cell) => cell !== null)) completed++;
    }
    const maxH = Math.max.apply(null, heights);
    // Preferir tablero plano y bajo; no recompensar “pegarse a la pared”
    return (
      completed * 800 -
      aggregate * 22 -
      holes * 140 -
      bumpiness * 28 -
      maxH * 30 -
      wells * 18
    );
  };

  Bot.findBestMove = function findBestMove(grid, type, cfg) {
    const E = T.Engine;
    cfg = cfg || {};
    const noise = typeof cfg.noise === "number" ? cfg.noise : 4;
    const mistakeChance = typeof cfg.mistakeChance === "number" ? cfg.mistakeChance : 0.05;
    const candidates = [];
    const maxRot = type === "O" ? 1 : 4;
    const center = (T.COLS - 1) / 2;

    for (let rot = 0; rot < maxRot; rot++) {
      for (let x = -2; x < T.COLS + 2; x++) {
        const piece = { type, rotation: rot, x, y: type === "I" ? -1 : 0 };
        if (E.collides(grid, piece)) continue;
        while (!E.collides(grid, piece, 0, 1)) piece.y++;
        const g2 = E.cloneGrid(grid);
        const topOut = E.lockOntoGrid(g2, piece);
        if (topOut) continue;
        const { cleared } = E.clearFullLines(g2);
        // Bonus por líneas + leve preferencia al centro (evita torre en un muro)
        let score = Bot.evaluateGrid(g2) + cleared * 180;
        score -= Math.abs(x + 1 - center) * 1.2;
        score -= piece.y * 0.4; // premia aterrizajes bajos
        score += (Math.random() - 0.5) * noise * 2;
        if (!Number.isFinite(score)) score = -1e9;
        candidates.push({ rot, x, score, cleared, y: piece.y });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || Math.abs(a.x - center) - Math.abs(b.x - center));
    if (Math.random() < mistakeChance && candidates.length > 3) {
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
          this.moveTimer = cfg.moveMs || 50;
          this.steps++;

          const forceDrop = () => {
            api.hardDropAndLock();
            this.reset(cfg);
            if (api.onAfterLock) api.onAfterLock();
            return "locked";
          };

          // Sin plan o atascado demasiado: replanificar una vez, luego soltar
          if (!this.plan) {
            this.plan = Bot.findBestMove(api.getGrid(), piece.type, cfg);
            if (!this.plan) return forceDrop();
          }
          if (this.steps > 48) return forceDrop();

          // Rotar hasta la orientación objetivo (máx 3 intentos por tick lógico)
          if (piece.rotation !== this.plan.rot) {
            const before = piece.rotation;
            const kick = api.tryRotateCW();
            if (kick < 0 || piece.rotation === before) {
              // No puede girar aquí: replanifica desde la orientación actual
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, cfg);
              if (!this.plan) return forceDrop();
            }
            return "moving";
          }

          if (piece.x < this.plan.x) {
            if (!api.tryMove(1, 0)) {
              // Bloqueado a la derecha: replanifica o drop
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, cfg);
              if (!this.plan || piece.x === this.plan.x) return forceDrop();
            }
            return "moving";
          }
          if (piece.x > this.plan.x) {
            if (!api.tryMove(-1, 0)) {
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, cfg);
              if (!this.plan || piece.x === this.plan.x) return forceDrop();
            }
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
