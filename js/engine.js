/**
 * Motor puro: grid, colisiones, rotación SRS, T-Spins, basura y puntuación.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Engine = {};

  Engine.createGrid = function createGrid() {
    return Array.from({ length: T.ROWS }, () => Array(T.COLS).fill(null));
  };

  Engine.shuffle = function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  Engine.cloneGrid = function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  };

  Engine.spawnPiece = function spawnPiece(type) {
    const matrix = T.SHAPES[type][0];
    const x = Math.floor((T.COLS - matrix[0].length) / 2);
    const y = type === "I" ? -1 : 0;
    return { type, rotation: 0, x, y };
  };

  Engine.getMatrix = function getMatrix(piece) {
    return T.SHAPES[piece.type][piece.rotation];
  };

  Engine.collides = function collides(grid, piece, ox = 0, oy = 0, rot = piece.rotation) {
    const matrix = T.SHAPES[piece.type][rot];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const nx = piece.x + c + ox;
        const ny = piece.y + r + oy;
        if (nx < 0 || nx >= T.COLS || ny >= T.ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  };

  Engine.ghostY = function ghostY(grid, piece) {
    let gy = 0;
    while (!Engine.collides(grid, piece, 0, gy + 1)) gy++;
    return piece.y + gy;
  };

  Engine.lockOntoGrid = function lockOntoGrid(grid, piece) {
    const matrix = Engine.getMatrix(piece);
    let topOut = false;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (y < 0) {
          topOut = true;
          continue;
        }
        if (y < T.ROWS && x >= 0 && x < T.COLS) grid[y][x] = piece.type;
      }
    }
    return topOut;
  };

  Engine.clearFullLines = function clearFullLines(grid) {
    let cleared = 0;
    const rows = [];
    for (let r = T.ROWS - 1; r >= 0; r--) {
      if (grid[r].every((cell) => cell !== null)) {
        rows.push(r);
        grid.splice(r, 1);
        grid.unshift(Array(T.COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return { cleared, rows };
  };

  Engine.isCellFilled = function isCellFilled(grid, x, y) {
    if (x < 0 || x >= T.COLS || y >= T.ROWS) return true;
    if (y < 0) return false;
    return grid[y][x] !== null;
  };

  /**
   * Detección T-Spin (regla de 3 esquinas / SRS).
   * Llamar ANTES de fijar la pieza en el grid.
   */
  Engine.detectTSpin = function detectTSpin(grid, piece, lastRotated, kickIndex) {
    if (!piece || piece.type !== "T" || !lastRotated) return null;

    const corners = [
      [piece.x, piece.y],
      [piece.x + 2, piece.y],
      [piece.x, piece.y + 2],
      [piece.x + 2, piece.y + 2],
    ];
    let filled = 0;
    const filledFlags = corners.map(([x, y]) => {
      const f = Engine.isCellFilled(grid, x, y);
      if (f) filled++;
      return f;
    });

    const frontPairs = [
      [2, 3],
      [0, 2],
      [0, 1],
      [1, 3],
    ];
    const fp = frontPairs[piece.rotation];
    const frontFilled = (filledFlags[fp[0]] ? 1 : 0) + (filledFlags[fp[1]] ? 1 : 0);

    if (filled >= 3) {
      if (frontFilled === 1 && kickIndex > 0) return "mini";
      return "full";
    }

    if (filled === 2) {
      const immobile =
        Engine.collides(grid, piece, -1, 0) &&
        Engine.collides(grid, piece, 1, 0) &&
        Engine.collides(grid, piece, 0, -1);
      if (immobile || kickIndex > 0) return "mini";
    }
    return null;
  };

  Engine.computeAttack = function computeAttack(cleared, tspin) {
    if (tspin) {
      const table = T.TSPIN_GARBAGE[tspin] || T.TSPIN_GARBAGE.full;
      return table[cleared] || 0;
    }
    return T.GARBAGE_SENT[cleared] || 0;
  };

  Engine.computeClearScore = function computeClearScore(cleared, tspin, level, backToBack) {
    let base = 0;
    if (tspin) base = (T.TSPIN_SCORES[tspin][cleared] || 0) * level;
    else base = (T.LINE_SCORES[cleared] || 0) * level;
    const isDifficult = cleared === 4 || (tspin && cleared > 0);
    if (isDifficult && backToBack) base = Math.floor(base * 1.5);
    return { points: base, isDifficult };
  };

  Engine.injectGarbage = function injectGarbage(grid, amount) {
    if (amount <= 0) return false;
    let topOut = false;
    for (let i = 0; i < amount; i++) {
      if (grid[0].some((c) => c !== null)) topOut = true;
      grid.shift();
      const hole = Math.floor(Math.random() * T.COLS);
      const row = Array(T.COLS).fill("G");
      row[hole] = null;
      grid.push(row);
    }
    return topOut;
  };

  /**
   * Prepara un asiento KO para revivir: limpia filas superiores y reaparece pieza.
   */
  Engine.reviveSeat = function reviveSeat(seat, clearTop) {
    if (!seat) return;
    const n = Math.max(0, Math.min(T.ROWS - 2, clearTop == null ? T.REVIVE_CLEAR_TOP : clearTop));
    for (let r = 0; r < n; r++) {
      seat.grid[r] = Array(T.COLS).fill(null);
    }
    // Baja el stack un poco si sigue muy alto
    let topRow = T.ROWS;
    for (let r = 0; r < T.ROWS; r++) {
      if (seat.grid[r].some((c) => c !== null)) {
        topRow = r;
        break;
      }
    }
    if (topRow < 4) {
      for (let k = 0; k < 4 - topRow; k++) {
        seat.grid.shift();
        seat.grid.push(Array(T.COLS).fill(null));
      }
    }
    seat.dead = false;
    seat.pendingGarbage = 0;
    seat.lockDelay = 0;
    seat.dropAccumulator = 0;
    seat.hardDropping = false;
    seat.lastRotated = false;
    seat.lastKickIndex = 0;
    seat.canHold = true;
    if (!seat.nextType) seat.nextType = Engine.nextFromBag(seat.bag);
    seat.current = Engine.spawnPiece(seat.nextType);
    seat.nextType = Engine.nextFromBag(seat.bag);
    if (Engine.collides(seat.grid, seat.current)) {
      if (!Engine.collides(seat.grid, seat.current, 0, -1)) seat.current.y -= 1;
    }
  };

  /** @returns {number} kick index, or -1 if failed */
  Engine.tryRotateOn = function tryRotateOn(grid, piece, dir) {
    if (piece.type === "O") return 0;
    const from = piece.rotation;
    const to = (from + dir + 4) % 4;
    const key = `${from}>${to}`;
    const kicks = piece.type === "I" ? T.KICKS_I[key] : T.KICKS_JLSTZ[key];
    for (let i = 0; i < kicks.length; i++) {
      const [kx, ky] = kicks[i];
      const ox = kx;
      const oy = -ky;
      if (!Engine.collides(grid, piece, ox, oy, to)) {
        piece.rotation = to;
        piece.x += ox;
        piece.y += oy;
        return i;
      }
    }
    return -1;
  };

  Engine.refillBag = function refillBag(bag) {
    bag.push(...Engine.shuffle([...T.TYPES]));
  };

  Engine.nextFromBag = function nextFromBag(bag) {
    if (bag.length === 0) Engine.refillBag(bag);
    return bag.pop();
  };

  Engine.createSeat = function createSeat(isBot) {
    const bag = [];
    Engine.refillBag(bag);
    const next = Engine.nextFromBag(bag);
    const curType = Engine.nextFromBag(bag);
    return {
      grid: Engine.createGrid(),
      bag,
      current: Engine.spawnPiece(curType),
      nextType: next,
      holdType: null,
      canHold: true,
      lines: 0,
      sent: 0,
      pendingGarbage: 0,
      dropAccumulator: 0,
      lockDelay: 0,
      hardDropping: false,
      dead: false,
      isBot,
      lastRotated: false,
      lastKickIndex: 0,
      backToBack: false,
      tspins: 0,
    };
  };

  T.Engine = Engine;
})(window.Tetris);
