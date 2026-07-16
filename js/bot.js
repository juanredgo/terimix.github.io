/**
 * IA del bot: detección de huecos/basura, setups (tetris / T-spin)
 * y decisión entre limpiar ya o guardar para más daño.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Bot = {};

  /** Firma barata del tablero para detectar basura / cambios mid-plan. */
  Bot.gridSignature = function gridSignature(grid) {
    let h = 0;
    for (let r = 0; r < T.ROWS; r++) {
      const row = grid[r];
      for (let c = 0; c < T.COLS; c++) {
        h = (h * 31 + (row[c] ? 1 + (c + 1) * (r + 3) : 0)) | 0;
      }
    }
    return h;
  };

  /**
   * Análisis completo del tablero.
   * - holes / holeDepth: huecos cubiertos (propios o de basura)
   * - openHoles: huecos de basura todavía "abiertos" por la columna
   * - tetrisWell: pozo de 1 columna útil para I
   * - almostFull: filas a 1-2 celdas de limpiar
   */
  Bot.analyzeGrid = function analyzeGrid(grid) {
    const heights = Array(T.COLS).fill(0);
    let holes = 0;
    let holeDepth = 0;
    let buried = 0;
    let aggregate = 0;
    let bumpiness = 0;
    let completed = 0;
    let wells = 0;
    let rowTrans = 0;
    let colTrans = 0;
    let almostFull = 0;
    let garbageCells = 0;

    for (let c = 0; c < T.COLS; c++) {
      let found = false;
      let h = 0;
      let blocksAbove = 0;
      for (let r = 0; r < T.ROWS; r++) {
        const cell = grid[r][c];
        if (cell) {
          if (!found) {
            found = true;
            h = T.ROWS - r;
          }
          blocksAbove++;
          if (cell === "G") garbageCells++;
        } else if (found) {
          holes++;
          holeDepth += blocksAbove;
          buried += blocksAbove;
        }
      }
      heights[c] = h;
      aggregate += h;
    }

    for (let c = 0; c < T.COLS - 1; c++) {
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    for (let c = 0; c < T.COLS; c++) {
      const left = c === 0 ? T.ROWS : heights[c - 1];
      const right = c === T.COLS - 1 ? T.ROWS : heights[c + 1];
      const depth = Math.min(left, right) - heights[c];
      if (depth > 0) wells += depth * depth; // pozos profundos más caros
    }

    for (let r = 0; r < T.ROWS; r++) {
      let filled = 0;
      let empty = 0;
      for (let c = 0; c < T.COLS; c++) {
        const a = grid[r][c];
        const b = c + 1 < T.COLS ? grid[r][c + 1] : true;
        if (!!a !== !!b) rowTrans++;
        if (a) filled++;
        else empty++;
      }
      if (empty === 0) completed++;
      else if (empty <= 2 && filled >= 8) almostFull++;
    }

    for (let c = 0; c < T.COLS; c++) {
      let prev = true; // techo
      for (let r = 0; r < T.ROWS; r++) {
        const cur = !!grid[r][c];
        if (cur !== prev) colTrans++;
        prev = cur;
      }
      if (!prev) colTrans++; // suelo
    }

    const maxH = Math.max.apply(null, heights);
    const minH = Math.min.apply(null, heights);

    // Mejor pozo de 1 columna para tetris (I vertical): vecinos más altos, profundidad ≥ 3
    let tetrisWell = 0;
    let wellCol = -1;
    for (let c = 0; c < T.COLS; c++) {
      const left = c === 0 ? heights[c] : heights[c - 1];
      const right = c === T.COLS - 1 ? heights[c] : heights[c + 1];
      const depth = Math.min(left, right) - heights[c];
      if (depth >= 3) {
        // Preferir pozo en borde o columna 0/9 (clásico) o cerca del mínimo
        const edgeBonus = c === 0 || c === T.COLS - 1 ? 1.2 : 1;
        const score = depth * edgeBonus - Math.abs(left - right) * 0.15;
        if (score > tetrisWell) {
          tetrisWell = score;
          wellCol = c;
        }
      }
    }

    // Setup T-spin rough: filas con 1 hueco y forma de T (hueco con soporte a los lados)
    let tspinSlots = 0;
    for (let r = 1; r < T.ROWS - 1; r++) {
      for (let c = 1; c < T.COLS - 1; c++) {
        if (grid[r][c]) continue;
        // Celda vacía con bloque debajo y al menos 2 de 3 vecinos en la fila superior ocupados
        if (!grid[r + 1][c]) continue;
        const upL = !!grid[r - 1][c - 1];
        const upC = !!grid[r - 1][c];
        const upR = !!grid[r - 1][c + 1];
        const sideL = !!grid[r][c - 1];
        const sideR = !!grid[r][c + 1];
        if (sideL && sideR && (upL || upR) && !upC) tspinSlots++;
        // Mini setup: hueco de basura tipo "T" en fila semi-llena
        if (sideL && sideR && upC) tspinSlots += 0.35;
      }
    }

    // Presión: altura + huecos + basura enterrada
    const pressure =
      maxH * 1.1 + holes * 2.4 + holeDepth * 0.35 + Math.max(0, aggregate - 40) * 0.15;

    return {
      heights,
      holes,
      holeDepth,
      buried,
      aggregate,
      bumpiness,
      completed,
      wells,
      rowTrans,
      colTrans,
      almostFull,
      garbageCells,
      maxH,
      minH,
      tetrisWell,
      wellCol,
      tspinSlots,
      pressure,
    };
  };

  /**
   * Puntuación del tablero resultante.
   * pressureMode: true → prioriza supervivencia y rellenar huecos.
   */
  Bot.evaluateGrid = function evaluateGrid(grid, opts) {
    opts = opts || {};
    const a = Bot.analyzeGrid(grid);
    const pressureMode = opts.pressureMode != null ? opts.pressureMode : a.pressure > 18;
    const stackMode = !pressureMode && a.holes <= 1 && a.maxH <= 12;

    let score = 0;

    // Huecos: castigo fuerte (el bot "dejaba huecos")
    score -= a.holes * (pressureMode ? 320 : 220);
    score -= a.holeDepth * (pressureMode ? 28 : 18);
    score -= a.buried * 6;

    // Superficie
    score -= a.aggregate * (pressureMode ? 28 : 18);
    score -= a.bumpiness * (pressureMode ? 36 : 24);
    score -= a.maxH * (pressureMode ? 55 : 28);
    score -= a.wells * (pressureMode ? 12 : 8);
    score -= a.rowTrans * 4;
    score -= a.colTrans * 3;

    // Filas completables
    score += a.almostFull * (pressureMode ? 90 : 40);
    score += a.completed * 50;

    // Modo stack: premiar pozo de tetris limpio y setups T
    if (stackMode) {
      score += Math.min(a.tetrisWell, 8) * 55;
      score += a.tspinSlots * 70;
      // Mantener el resto plano
      if (a.holes === 0) score += 120;
      if (a.bumpiness < 6) score += 40;
    } else if (!pressureMode && a.holes === 0) {
      score += Math.min(a.tetrisWell, 6) * 30;
      score += a.tspinSlots * 35;
    }

    // Basura: si hay G, recompensar tableros que no entierren más
    if (a.garbageCells > 0) {
      score -= a.holes * 40;
      score += a.almostFull * 50;
    }

    return score;
  };

  /** Valor de ataque estimado (alineado con engine + B2B opcional). */
  Bot.attackValue = function attackValue(cleared, tspin, backToBack) {
    let atk = 0;
    if (tspin) {
      const table = T.TSPIN_GARBAGE[tspin] || T.TSPIN_GARBAGE.full;
      atk = table[cleared] || 0;
    } else {
      atk = T.GARBAGE_SENT[cleared] || 0;
    }
    const difficult = cleared === 4 || (tspin && cleared > 0);
    if (difficult && backToBack) atk += 1;
    return atk;
  };

  /**
   * ¿Esta colocación rellena huecos existentes?
   * Compara análisis pre/post.
   */
  Bot.holeDeltaBonus = function holeDeltaBonus(before, after, pressureMode) {
    const dHoles = before.holes - after.holes;
    const dDepth = before.holeDepth - after.holeDepth;
    let b = 0;
    if (dHoles > 0) b += dHoles * (pressureMode ? 380 : 260);
    if (dHoles < 0) b += dHoles * (pressureMode ? 400 : 280); // crear huecos = muy malo
    b += dDepth * (pressureMode ? 22 : 14);
    return b;
  };

  /**
   * Bonus por "inversión inteligente":
   * - Bajo presión: limpiar y bajar altura.
   * - Sin presión: no gastar singles tontos; premiar tetris / T-spin / guardar pozo.
   */
  Bot.strategyBonus = function strategyBonus(before, after, cleared, tspin, type, pieceY, wellCol) {
    const pressureMode = before.pressure > 18 || before.maxH >= 14 || before.holes >= 3;
    const midPressure = !pressureMode && (before.maxH >= 10 || before.holes >= 1);
    let s = 0;

    const atk = Bot.attackValue(cleared, tspin, false);
    // Daño es el objetivo ofensivo principal
    s += atk * (pressureMode ? 160 : 220);
    s += cleared * (pressureMode ? 140 : 60);

    if (tspin === "full") s += 180 + cleared * 80;
    else if (tspin === "mini") s += 40 + cleared * 30;

    // Tetris (4 líneas) es oro
    if (cleared === 4) s += 520;
    // Triple decente
    if (cleared === 3 && !tspin) s += 80;

    if (pressureMode) {
      // Supervivencia: cualquier limpia que baje el techo
      s += (before.maxH - after.maxH) * 90;
      s += (before.aggregate - after.aggregate) * 6;
      // Castigar no limpiar si hay muchos huecos y la pieza no rellena
      if (cleared === 0 && before.holes >= 2 && after.holes >= before.holes) s -= 80;
    } else {
      // Stack inteligente: singles sin T-spin rompen el build
      if (cleared === 1 && !tspin) s -= 160;
      if (cleared === 2 && !tspin && before.tetrisWell >= 3) s -= 90;
      // Guardar el pozo de tetris
      if (after.tetrisWell >= before.tetrisWell && after.holes <= before.holes) {
        s += 45;
      }
      // Si se coloca I en el pozo y hace tetris
      if (type === "I" && cleared === 4) s += 200;
      // Premiar bajar poco el pozo al colocar sin limpiar (construir altura del well)
      if (cleared === 0 && after.tetrisWell > before.tetrisWell) s += 70;
      if (cleared === 0 && after.tspinSlots > before.tspinSlots) s += 55;
    }

    if (midPressure) {
      // Preferir limpia media o relleno de huecos
      if (cleared >= 2) s += 100;
      if (after.holes < before.holes) s += 150;
    }

    // No dejar piezas flotando raras: premia aterrizaje más bajo un poco
    s -= pieceY * 0.25;

    // Si había pozo y lo tapamos con basura de stack, castigo
    if (before.wellCol >= 0 && after.holes > before.holes && wellCol === before.wellCol) {
      s -= 120;
    }

    return s;
  };

  /**
   * Simula un hard-drop en (rot, x) y devuelve score + meta.
   */
  Bot.scorePlacement = function scorePlacement(grid, type, rot, x, before, cfg) {
    const E = T.Engine;
    const piece = { type, rotation: rot, x, y: type === "I" ? -1 : 0 };
    if (E.collides(grid, piece)) return null;
    while (!E.collides(grid, piece, 0, 1)) piece.y++;

    // Detectar T-spin antes de lock
    let tspin = null;
    if (type === "T") {
      // Asumimos rotación al final (bot gira en aire y drop); kickIndex 0
      tspin = E.detectTSpin(grid, piece, true, 0);
    }

    const g2 = E.cloneGrid(grid);
    if (E.lockOntoGrid(g2, piece)) return null;
    const { cleared } = E.clearFullLines(g2);
    if (type === "T" && cleared > 0 && !tspin) {
      // re-check post no; detect is pre-lock only
    }

    const after = Bot.analyzeGrid(g2);
    const pressureMode = before.pressure > 18 || before.maxH >= 14 || before.holes >= 3;
    const center = (T.COLS - 1) / 2;

    let score = Bot.evaluateGrid(g2, { pressureMode });
    score += Bot.holeDeltaBonus(before, after, pressureMode);
    score += Bot.strategyBonus(before, after, cleared, tspin, type, piece.y, before.wellCol);

    // Leve preferencia al centro solo si no hay pozo de tetris
    if (before.tetrisWell < 3) score -= Math.abs(x + 1 - center) * 1.1;

    // Ruido / errores por dificultad
    const noise = typeof cfg.noise === "number" ? cfg.noise : 4;
    score += (Math.random() - 0.5) * noise * 2;
    if (!Number.isFinite(score)) score = -1e9;

    return {
      rot,
      x,
      score,
      cleared,
      y: piece.y,
      tspin,
      holesAfter: after.holes,
      attack: Bot.attackValue(cleared, tspin, false),
    };
  };

  /**
   * Enumera todas las colocaciones de una pieza.
   */
  Bot.enumerateMoves = function enumerateMoves(grid, type, before, cfg) {
    const candidates = [];
    const maxRot = type === "O" ? 1 : 4;
    for (let rot = 0; rot < maxRot; rot++) {
      for (let x = -2; x < T.COLS + 2; x++) {
        const m = Bot.scorePlacement(grid, type, rot, x, before, cfg);
        if (m) candidates.push(m);
      }
    }
    return candidates;
  };

  /**
   * Mejor jugada. cfg opcional:
   *   noise, mistakeChance, nextType, holdType, canHold
   * Si hay nextType, hace un 1-ply lookahead barato sobre las mejores N.
   */
  Bot.findBestMove = function findBestMove(grid, type, cfg) {
    cfg = cfg || {};
    const mistakeChance = typeof cfg.mistakeChance === "number" ? cfg.mistakeChance : 0.05;
    const before = Bot.analyzeGrid(grid);
    const center = (T.COLS - 1) / 2;

    let candidates = Bot.enumerateMoves(grid, type, before, cfg);

    // Considerar HOLD si mejora (I/T para setups, o pieza mala con huecos)
    if (cfg.canHold && (cfg.holdType || cfg.nextType)) {
      const held = cfg.holdType || cfg.nextType;
      if (held && held !== type) {
        const holdMoves = Bot.enumerateMoves(grid, held, before, cfg);
        for (let i = 0; i < holdMoves.length; i++) {
          holdMoves[i].useHold = true;
          holdMoves[i].score += 8; // hold es gratis si mejora
          candidates.push(holdMoves[i]);
        }
      }
    }

    if (!candidates.length) return null;

    // Lookahead 1 pieza (normal/difícil; en fácil el ruido ya basta)
    const doLookahead = cfg.nextType && (cfg.noise == null || cfg.noise <= 10);
    if (doLookahead) {
      candidates.sort((a, b) => b.score - a.score);
      const topN = Math.min(8, candidates.length);
      for (let i = 0; i < topN; i++) {
        const m = candidates[i];
        if (m.useHold) continue; // skip deep hold+next por simplicidad
        const g2 = T.Engine.cloneGrid(grid);
        const piece = { type, rotation: m.rot, x: m.x, y: type === "I" ? -1 : 0 };
        if (T.Engine.collides(g2, piece)) continue;
        while (!T.Engine.collides(g2, piece, 0, 1)) piece.y++;
        if (T.Engine.lockOntoGrid(g2, piece)) continue;
        T.Engine.clearFullLines(g2);
        const nextBest = Bot.enumerateMoves(g2, cfg.nextType, Bot.analyzeGrid(g2), {
          noise: 0,
          mistakeChance: 0,
        });
        if (nextBest.length) {
          nextBest.sort((a, b) => b.score - a.score);
          // Mezcla: presente + futuro (daño combinado y tablero)
          m.score = m.score * 0.62 + nextBest[0].score * 0.38;
          m.score += (m.attack + (nextBest[0].attack || 0)) * 25;
        }
      }
    }

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        (b.attack || 0) - (a.attack || 0) ||
        (a.holesAfter || 0) - (b.holesAfter || 0) ||
        Math.abs(a.x - center) - Math.abs(b.x - center)
    );

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
   * Driver: piensa → (hold?) → rota/mueve → hard drop.
   * Replanifica si el tablero cambia (basura entrante).
   */
  Bot.createDriver = function createDriver() {
    return {
      plan: null,
      phase: "think",
      thinkTimer: 0,
      moveTimer: 0,
      steps: 0,
      dropAcc: 0,
      plannedSig: 0,

      reset: function (cfg) {
        this.plan = null;
        this.phase = "think";
        this.thinkTimer = cfg ? Bot.randRange(cfg.thinkMs[0], cfg.thinkMs[1]) : 0;
        this.moveTimer = 0;
        this.steps = 0;
        this.dropAcc = 0;
        this.plannedSig = 0;
      },

      _buildCfg: function (cfg, api) {
        const c = Object.assign({}, cfg);
        if (api.getNextType) c.nextType = api.getNextType();
        if (api.getHoldType) c.holdType = api.getHoldType();
        if (api.canHold) c.canHold = !!api.canHold();
        return c;
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
          if (!grounded) {
            while (this.dropAcc >= cfg.dropInterval) {
              this.dropAcc -= cfg.dropInterval;
              api.gravityStep();
            }
          }
        }

        // Si el grid cambió (basura), invalidar plan
        const sig = Bot.gridSignature(api.getGrid());
        if (this.plan && this.plannedSig && sig !== this.plannedSig) {
          this.plan = null;
          this.phase = "think";
          this.thinkTimer = Math.min(this.thinkTimer || 0, 40);
        }

        if (this.phase === "think") {
          this.thinkTimer -= dt;
          if (this.thinkTimer <= 0) {
            const fullCfg = this._buildCfg(cfg, api);
            this.plan = Bot.findBestMove(api.getGrid(), piece.type, fullCfg);
            this.plannedSig = Bot.gridSignature(api.getGrid());
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

          if (!this.plan) {
            this.plan = Bot.findBestMove(api.getGrid(), piece.type, this._buildCfg(cfg, api));
            this.plannedSig = Bot.gridSignature(api.getGrid());
            if (!this.plan) return forceDrop();
          }
          if (this.steps > 56) return forceDrop();

          // HOLD si el plan lo pide
          if (this.plan.useHold && api.tryHold && api.canHold && api.canHold()) {
            const ok = api.tryHold();
            this.plan = null;
            this.phase = "think";
            this.thinkTimer = 20;
            this.plannedSig = 0;
            return ok ? "moving" : forceDrop();
          }

          // Rotar hasta orientación objetivo
          if (piece.rotation !== this.plan.rot) {
            const before = piece.rotation;
            const kick = api.tryRotateCW();
            if (kick < 0 || piece.rotation === before) {
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, this._buildCfg(cfg, api));
              this.plannedSig = Bot.gridSignature(api.getGrid());
              if (!this.plan) return forceDrop();
            }
            return "moving";
          }

          if (piece.x < this.plan.x) {
            if (!api.tryMove(1, 0)) {
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, this._buildCfg(cfg, api));
              this.plannedSig = Bot.gridSignature(api.getGrid());
              if (!this.plan || piece.x === this.plan.x) return forceDrop();
            }
            return "moving";
          }
          if (piece.x > this.plan.x) {
            if (!api.tryMove(-1, 0)) {
              this.plan = Bot.findBestMove(api.getGrid(), piece.type, this._buildCfg(cfg, api));
              this.plannedSig = Bot.gridSignature(api.getGrid());
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
