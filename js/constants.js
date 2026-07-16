/**
 * Constantes del juego: tablero, piezas, kicks SRS, puntuación y bot.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  T.COLS = 10;
  T.ROWS = 20;
  T.MAX_RANK = 10;
  T.STORAGE_KEY = "tetris-ranking-v1";
  T.MUTE_KEY = "tetris-muted";
  T.NAME_KEY = "tetris-player-name";
  T.DIFF_KEY = "tetris-bot-diff";
  T.BOSS_DIFF_KEY = "tetris-boss-diff";
  T.LOCK_MS = 500;
  T.DAS = 170;
  T.ARR = 40;
  T.SOFT_DROP_INTERVAL = 100;
  /** Líneas que debe limpiar el compañero vivo para revivir al KO en coop */
  T.REVIVE_LINES_NEED = 10;
  /** Filas superiores que se limpian al revivir (aire fresco) */
  T.REVIVE_CLEAR_TOP = 8;

  T.COLORS = {
    I: "#5cc8d8",
    O: "#e0c848",
    T: "#b078c8",
    S: "#60c868",
    Z: "#d06058",
    J: "#6890d0",
    L: "#e09848",
    G: "#3a3a32",
    GRID: "rgba(90, 90, 55, 0.22)",
  };

  T.SHAPES = {
    I: [
      [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
      [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    ],
    O: [
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
    ],
    T: [
      [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
    ],
    S: [
      [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
      [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
      [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
    ],
    Z: [
      [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
      [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
    ],
    J: [
      [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
      [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
    ],
    L: [
      [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
      [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
      [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
    ],
  };

  T.KICKS_JLSTZ = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };

  T.KICKS_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  /** Kicks de rotación 180° (estilo guideline / community). ky en coords SRS. */
  T.KICKS_180_JLSTZ = {
    "0>2": [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [-1, 0], [-2, 0], [-1, 1], [-2, 1], [0, -1], [3, 0], [-3, 0]],
    "2>0": [[0, 0], [-1, 0], [-2, 0], [-1, -1], [-2, -1], [1, 0], [2, 0], [1, -1], [2, -1], [0, 1], [-3, 0], [3, 0]],
    "1>3": [[0, 0], [0, 1], [0, 2], [-1, 1], [-1, 2], [0, -1], [0, -2], [-1, -1], [-1, -2], [1, 0], [0, 3], [0, -3]],
    "3>1": [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [0, -1], [0, -2], [1, -1], [1, -2], [-1, 0], [0, 3], [0, -3]],
  };

  T.KICKS_180_I = {
    "0>2": [[0, 0], [-1, 0], [-2, 0], [1, 0], [2, 0], [0, 1]],
    "2>0": [[0, 0], [1, 0], [2, 0], [-1, 0], [-2, 0], [0, -1]],
    "1>3": [[0, 0], [0, 1], [0, 2], [0, -1], [0, -2], [-1, 0]],
    "3>1": [[0, 0], [0, 1], [0, 2], [0, -1], [0, -2], [1, 0]],
  };

  T.TYPES = Object.keys(T.SHAPES);
  T.LINE_SCORES = [0, 100, 300, 500, 800];
  T.GARBAGE_SENT = [0, 0, 1, 2, 4];
  T.TSPIN_GARBAGE = { mini: [0, 0, 1, 0], full: [0, 2, 4, 6] };
  T.TSPIN_SCORES = {
    mini: [100, 200, 400, 0],
    full: [400, 800, 1200, 1600],
  };

  /**
   * Dificultad del bot / boss.
   * - mistakeChance / noise: más alto = más errores (Normal no debe aplastar).
   * - lookahead / useHold: solo Difícil usa IA “completa”.
   * - skill: 0–1 escala la agresividad ofensiva de la evaluación.
   */
  T.BOT_DIFF = {
    easy: {
      label: "Fácil",
      thinkMs: [420, 780],
      moveMs: 100,
      dropInterval: 980,
      mistakeChance: 0.34,
      noise: 28,
      lookahead: false,
      useHold: false,
      skill: 0.35,
    },
    normal: {
      label: "Normal",
      thinkMs: [210, 380],
      moveMs: 62,
      dropInterval: 680,
      mistakeChance: 0.13,
      noise: 11,
      lookahead: false,
      useHold: true,
      skill: 0.68,
    },
    hard: {
      label: "Difícil",
      thinkMs: [100, 200],
      moveMs: 42,
      dropInterval: 460,
      mistakeChance: 0.11,
      noise: 8,
      lookahead: true,
      useHold: true,
      skill: 0.78,
    },
  };

  /** Boss coop 2v1: un peldaño por encima del bot versus. */
  T.BOSS_DIFF = {
    easy: {
      label: "Fácil",
      thinkMs: [320, 580],
      moveMs: 85,
      dropInterval: 860,
      mistakeChance: 0.28,
      noise: 22,
      lookahead: false,
      useHold: false,
      skill: 0.4,
    },
    normal: {
      label: "Normal",
      thinkMs: [160, 300],
      moveMs: 55,
      dropInterval: 560,
      mistakeChance: 0.11,
      noise: 9,
      lookahead: false,
      useHold: true,
      skill: 0.72,
    },
    hard: {
      label: "Difícil",
      thinkMs: [85, 160],
      moveMs: 36,
      dropInterval: 400,
      mistakeChance: 0.09,
      noise: 7,
      lookahead: true,
      useHold: true,
      skill: 0.84,
    },
  };
})(window.Tetris);
