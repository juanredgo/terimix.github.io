/**
 * Orquestación: modos solo/versus, input, loop y UI.
 * Depende de: constants, engine, render, audio, fx, ranking, bot.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const E = T.Engine;
  const R = T.Render;
  const SFX = T.SFX;
  const MUSIC = T.MUSIC;
  const FX = T.FX;
  const Ranking = T.Ranking;
  const Bot = T.Bot;

  // ——— DOM ———
  const $ = (id) => document.getElementById(id);
  const layoutSolo = $("layout-solo");
  const layoutVersus = $("layout-versus");
  const subtitle = $("subtitle");
  const btnMode = $("btn-mode");
  const boardCanvas = $("board");
  const holdCanvas = $("hold");
  const nextCanvas = $("next");
  const boardCtx = boardCanvas.getContext("2d");
  const holdCtx = holdCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  const vsBoardCanvas = $("vs-board");
  const vsHoldCanvas = $("vs-hold");
  const vsNextCanvas = $("vs-next");
  const botBoardCanvas = $("bot-board");
  const botNextCanvas = $("bot-next");
  const vsBoardCtx = vsBoardCanvas.getContext("2d");
  const vsHoldCtx = vsHoldCanvas.getContext("2d");
  const vsNextCtx = vsNextCanvas.getContext("2d");
  const botBoardCtx = botBoardCanvas.getContext("2d");
  const botNextCtx = botNextCanvas.getContext("2d");
  const scoreEl = $("score");
  const linesEl = $("lines");
  const levelEl = $("level");
  const highScoreEl = $("high-score");
  const tspinCountEl = $("tspin-count");
  const overlay = $("overlay");
  const overlayTitle = $("overlay-title");
  const overlayMsg = $("overlay-msg");
  const btnStart = $("btn-start");
  const nameForm = $("name-form");
  const playerNameInput = $("player-name");
  const btnSaveScore = $("btn-save-score");
  const modePicker = $("mode-picker");
  const vsDiffPicker = $("vs-diff-picker");
  const rankingModal = $("ranking-modal");
  const btnMute = $("btn-mute");
  const btnRanking = $("btn-ranking");
  const btnCloseRanking = $("btn-close-ranking");
  const btnCloseRanking2 = $("btn-close-ranking-2");
  const btnClearRanking = $("btn-clear-ranking");
  const vsOverlay = $("vs-overlay");
  const vsOverlayTitle = $("vs-overlay-title");
  const vsOverlayMsg = $("vs-overlay-msg");
  const vsOverlayDiff = $("vs-overlay-diff");
  const btnVsStart = $("btn-vs-start");
  const btnBackSolo = $("btn-back-solo");
  const coopOverlay = $("coop-overlay");
  const coopOverlayTitle = $("coop-overlay-title");
  const coopOverlayMsg = $("coop-overlay-msg");
  const btnCoopBack = $("btn-coop-back");
  const vsPLines = $("vs-p-lines");
  const vsPSent = $("vs-p-sent");
  const vsBLines = $("vs-b-lines");
  const vsBSent = $("vs-b-sent");
  const vsPGarbage = $("vs-p-garbage");
  const vsBGarbage = $("vs-b-garbage");
  const vsBotLabel = $("vs-bot-label");
  const vsKoFeed = $("vs-ko-feed");
  const soloBoardWrap = $("solo-board-wrap");
  const vsPlayerWrap = $("vs-player-wrap");

  const layoutCoop = $("layout-coop");
  const coopP1Wrap = $("coop-p1-wrap");
  const coopP2Wrap = $("coop-p2-wrap");
  const coopBossWrap = $("coop-boss-wrap");
  const coopP1BoardCanvas = $("coop-p1-board");
  const coopP2BoardCanvas = $("coop-p2-board");
  const coopBossBoardCanvas = $("coop-boss-board");
  const coopP1HoldCanvas = $("coop-p1-hold");
  const coopP2HoldCanvas = $("coop-p2-hold");
  const coopP1NextCanvas = $("coop-p1-next");
  const coopP2NextCanvas = $("coop-p2-next");
  const coopBossNextCanvas = $("coop-boss-next");

  const coopP1BoardCtx = coopP1BoardCanvas.getContext("2d");
  const coopP2BoardCtx = coopP2BoardCanvas.getContext("2d");
  const coopBossBoardCtx = coopBossBoardCanvas.getContext("2d");
  const coopP1HoldCtx = coopP1HoldCanvas.getContext("2d");
  const coopP2HoldCtx = coopP2HoldCanvas.getContext("2d");
  const coopP1NextCtx = coopP1NextCanvas.getContext("2d");
  const coopP2NextCtx = coopP2NextCanvas.getContext("2d");
  const coopBossNextCtx = coopBossNextCanvas.getContext("2d");

  const coopP1Garbage = $("coop-p1-garbage");
  const coopP2Garbage = $("coop-p2-garbage");
  const coopBossGarbage = $("coop-boss-garbage");
  const coopP1Sent = $("coop-p1-sent");
  const coopP2Sent = $("coop-p2-sent");
  const coopBossDamage = $("coop-boss-damage");
  const coopKoFeed = $("coop-ko-feed");

  // ——— Estado global (también en T para audio/fx) ———
  T.gameMode = "solo";
  T.state = "menu";

  let gameMode = "solo";
  let botDiff = localStorage.getItem(T.DIFF_KEY) || "normal";
  if (!T.BOT_DIFF[botDiff]) botDiff = "normal";
  let state = "menu";
  let lastTime = 0;

  // Solo
  let grid = E.createGrid();
  let bag = [];
  let current = null;
  let nextType = null;
  let holdType = null;
  let canHold = true;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccumulator = 0;
  let lockDelay = 0;
  let softDropping = false;
  let hardDropping = false;
  let pendingScoreSave = false;
  let lastHighlightId = null;
  let lastRotated = false;
  let lastKickIndex = 0;
  let backToBack = false;
  let tspinCount = 0;

  // Drivers de bot (versus / auto / coop boss)
  const vsBotDriver = Bot.createDriver();
  const autoDriver = Bot.createDriver();
  const bossDriver = Bot.createDriver();

  // Versus / online / coop seats
  let p = null;
  let b = null;
  let boss = null;

  function usesSoloLayout() {
    return gameMode === "solo" || gameMode === "auto";
  }

  function modeLabel() {
    if (gameMode === "versus") return "VS";
    if (gameMode === "auto") return "AUTO";
    if (gameMode === "online") return "ONL";
    if (gameMode === "coop") return "COOP";
    return "1P";
  }

  function nextMode(current) {
    if (current === "solo") return "auto";
    if (current === "auto") return "versus";
    if (current === "versus") return "online";
    if (current === "online") return "coop";
    return "solo";
  }

  function resetAutoBrain() {
    autoDriver.reset(T.BOT_DIFF[botDiff]);
  }

  function showRematchButton(show) {
    const btn = $("btn-online-rematch");
    if (!btn) return;
    const ok = !!show && T.Online && T.Online.isConnected;
    btn.classList.toggle("hidden", !ok);
  }

  function setState(s) {
    state = s;
    T.state = s;
  }

  function setMode(m) {
    gameMode = m;
    T.gameMode = m;
  }

  function activeBoardWrap() {
    if (gameMode === "coop") return coopP1Wrap;
    return (gameMode === "versus" || gameMode === "online") ? vsPlayerWrap : soloBoardWrap;
  }

  function subtitleForMode() {
    if (gameMode === "versus") return "Versus BOT · Chiptune · T-Spins";
    if (gameMode === "auto") return `Auto · BOT ${T.BOT_DIFF[botDiff].label} · Mira y disfruta`;
    if (gameMode === "online") return "Online P2P · vs Amigo · Sin Delay";
    if (gameMode === "coop") return "Coop 2v1 P2P · Derrota al Boss Boss Boss";
    return "Chiptune · T-Spins · Ranking";
  }

  function updateMuteButton() {
    btnMute.textContent = SFX.isMuted() ? "🔇" : "🔊";
    btnMute.classList.toggle("muted", SFX.isMuted());
  }

  function updateHighScoreDisplay() {
    highScoreEl.textContent = String(Ranking.getHighScore());
  }

  function updateSoloHUD() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
    if (tspinCountEl) tspinCountEl.textContent = String(tspinCount);
  }

  function updateGarbageMeters() {
    if (gameMode === "coop") {
      updateCoopHUD();
      return;
    }
    if (!p || !b) return;
    vsPGarbage.style.setProperty("--g", String(Math.min(100, p.pendingGarbage * 5)));
    vsBGarbage.style.setProperty("--g", String(Math.min(100, b.pendingGarbage * 5)));
  }

  function updateVsHUD() {
    if (!p || !b) return;
    vsPLines.textContent = String(p.lines);
    vsPSent.textContent = String(p.sent);
    vsBLines.textContent = String(b.lines);
    vsBSent.textContent = String(b.sent);
    updateGarbageMeters();
  }

  function flashKo(text) {
    vsKoFeed.textContent = text;
    vsKoFeed.classList.remove("flash");
    void vsKoFeed.offsetWidth;
    vsKoFeed.classList.add("flash");
  }

  // ——— Versus seat helpers ———
  function applyGarbageOnSpawn(seat) {
    if (seat.pendingGarbage <= 0) return false;
    const n = seat.pendingGarbage;
    seat.pendingGarbage = 0;
    const topOut = E.injectGarbage(seat.grid, n);
    if (!seat.isBot) SFX.garbage();
    updateGarbageMeters();
    return topOut;
  }

  function sendGarbage(from, to, attack, label) {
    if (attack <= 0) return;
    if (from.pendingGarbage > 0) {
      const cancel = Math.min(from.pendingGarbage, attack);
      from.pendingGarbage -= cancel;
      attack -= cancel;
    }
    if (attack > 0) {
      if (gameMode === "coop") {
        if (from === boss) {
          // El Boss ataca alternadamente a los jugadores
          const target = boss.sent % 2 === 0 ? p : b;
          if (target === p) {
            p.pendingGarbage += attack;
            flashKoCoop(`¡BOSS ATACA A TI +${attack}!`);
          } else {
            T.Online.sendGarbage(attack, "player");
            flashKoCoop(`¡BOSS ATACA A AMIGO +${attack}!`);
          }
          boss.sent += attack;
        } else {
          // Ataque de jugador contra Boss
          if (!T.Online.isHost) {
            T.Online.sendGarbage(attack, "boss");
          } else {
            boss.pendingGarbage += attack;
          }
          from.sent += attack;
          flashKoCoop(`¡DAÑO AL BOSS +${attack}!`);
        }
      } else if (gameMode === "online") {
        T.Online.sendGarbage(attack, "player");
        from.sent += attack;
        flashKo(`ENVIADO +${attack}`);
      } else {
        to.pendingGarbage += attack;
        from.sent += attack;
        if (!from.isBot) flashKo(label || `¡${attack} basura!`);
        else flashKo(`BOT +${attack}`);
      }
    }
    updateGarbageMeters();
  }

  function seatLock(seat, opponent, { playSfx = true } = {}) {
    const piece = seat.current;
    const tspin = E.detectTSpin(seat.grid, piece, seat.lastRotated, seat.lastKickIndex);
    const block = (gameMode === "versus" || gameMode === "online") ? 24 : (gameMode === "coop" ? 20 : 30);
    if (E.lockOntoGrid(seat.grid, piece)) {
      seat.dead = true;
      return;
    }
    if (playSfx && !seat.isBot && !seat.hardDropping) SFX.lock();

    const { cleared, rows } = E.clearFullLines(seat.grid);
    seat.hardDropping = false;

    if (tspin && !seat.isBot) {
      seat.tspins++;
      SFX.tspin(tspin);
      FX.burst((piece.x + 1.5) * block, (piece.y + 1.5) * block, "#9868a8", 28, 3.5);
      FX.burst((piece.x + 1.5) * block, (piece.y + 1.5) * block, "#c8a0d0", 12, 2);
      FX.shake(activeBoardWrap());
      FX.flash(activeBoardWrap(), "tspin");
    }

    if (cleared > 0) {
      seat.lines += cleared;
      const colors = ["#58a8b8", "#9868a8", "#58a858", "#c8b040", "#b85048"];
      if (!seat.isBot) {
        FX.lineBurst(rows, block, colors);
        FX.shake(activeBoardWrap());
        if (cleared >= 4) {
          FX.flash(activeBoardWrap(), "tetris");
          FX.showBanner("TETRIS!", "tetris");
        }
      }

      const wasB2B = seat.backToBack;
      let attack = E.computeAttack(cleared, tspin);
      const isDifficult = cleared === 4 || (tspin && cleared > 0);
      if (isDifficult && wasB2B) attack += 1;
      seat.backToBack = isDifficult;

      if (tspin && !seat.isBot) {
        const lineNames = ["", "SINGLE", "DOUBLE", "TRIPLE"];
        const core =
          tspin === "mini"
            ? `T-SPIN MINI${cleared ? " " + (lineNames[cleared] || "") : ""}`
            : `T-SPIN${cleared ? " " + (lineNames[cleared] || "") : ""}`;
        FX.showBanner((wasB2B && isDifficult ? "B2B " : "") + core.trim(), tspin === "mini" ? "mini" : "tspin");
      }

      if (playSfx && !seat.isBot && !tspin) SFX.clear(cleared);
      // coop/online: sendGarbage gestiona destinos aunque opponent sea null (boss)
      if (opponent || gameMode === "coop" || gameMode === "online") {
        sendGarbage(seat, opponent, attack, tspin ? `T-Spin → ${attack}` : `¡${attack} basura!`);
      }
    } else if (tspin && !seat.isBot) {
      FX.showBanner(tspin === "mini" ? "T-SPIN MINI" : "T-SPIN", tspin === "mini" ? "mini" : "tspin");
    }

    seat.lastRotated = false;
    seat.lastKickIndex = 0;
    seat.current = E.spawnPiece(seat.nextType);
    seat.nextType = E.nextFromBag(seat.bag);
    seat.canHold = true;
    seat.lockDelay = 0;
    if (applyGarbageOnSpawn(seat) || E.collides(seat.grid, seat.current)) seat.dead = true;
  }

  function seatTryMove(seat, dx, dy) {
    if (!E.collides(seat.grid, seat.current, dx, dy)) {
      seat.current.x += dx;
      seat.current.y += dy;
      if (dx !== 0) {
        seat.lastRotated = false;
        seat.lastKickIndex = 0;
      }
      if (dy > 0 || E.collides(seat.grid, seat.current, 0, 1)) seat.lockDelay = 0;
      return true;
    }
    return false;
  }

  function seatHold(seat) {
    if (!seat.canHold) return;
    seat.canHold = false;
    seat.lastRotated = false;
    seat.lastKickIndex = 0;
    if (!seat.isBot) SFX.hold();
    if (seat.holdType === null) {
      seat.holdType = seat.current.type;
      seat.current = E.spawnPiece(seat.nextType);
      seat.nextType = E.nextFromBag(seat.bag);
    } else {
      const swap = seat.holdType;
      seat.holdType = seat.current.type;
      seat.current = E.spawnPiece(swap);
    }
    seat.lockDelay = 0;
    if (E.collides(seat.grid, seat.current)) {
      if (!E.collides(seat.grid, seat.current, 0, -1)) seat.current.y -= 1;
      else seat.dead = true;
    }
  }

  // ——— Solo ———
  function soloNext() {
    return E.nextFromBag(bag);
  }

  function soloLock() {
    const piece = current;
    const tspin = E.detectTSpin(grid, piece, lastRotated, lastKickIndex);
    const block = 30;

    if (E.lockOntoGrid(grid, piece)) {
      endSoloGame();
      return;
    }
    if (!hardDropping) SFX.lock();
    const { cleared, rows } = E.clearFullLines(grid);
    hardDropping = false;

    if (tspin) {
      tspinCount++;
      SFX.tspin(tspin);
      FX.burst((piece.x + 1.5) * block, (piece.y + 1.5) * block, "#9868a8", 30, 3.6);
      FX.burst((piece.x + 1.5) * block, (piece.y + 1.5) * block, "#c8a0d0", 10, 2.2);
      FX.shake(soloBoardWrap);
      FX.flash(soloBoardWrap, "tspin");
    }

    if (cleared > 0) {
      const wasB2B = backToBack;
      const { points, isDifficult } = E.computeClearScore(cleared, tspin, level, wasB2B);
      score += points;
      lines += cleared;

      FX.lineBurst(rows, block, ["#58a8b8", "#9868a8", "#58a858", "#c8b040", "#b85048", "#c88838"]);
      FX.shake(soloBoardWrap);
      FX.floatText(`+${points}`, 150, rows[0] * block, "#c8b040");

      if (tspin) {
        const lineNames = ["", "SINGLE", "DOUBLE", "TRIPLE"];
        const core =
          tspin === "mini"
            ? `T-SPIN MINI${cleared ? " " + (lineNames[cleared] || "") : ""}`
            : `T-SPIN${cleared ? " " + (lineNames[cleared] || "") : ""}`;
        FX.showBanner((wasB2B && isDifficult ? "B2B " : "") + core.trim(), tspin === "mini" ? "mini" : "tspin");
      } else if (cleared >= 4) {
        FX.flash(soloBoardWrap, "tetris");
        FX.showBanner(wasB2B ? "B2B TETRIS!" : "TETRIS!", wasB2B ? "b2b" : "tetris");
      }

      if (!tspin) SFX.clear(cleared);
      backToBack = isDifficult;

      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(80, 1000 - (level - 1) * 85);
        SFX.levelUp();
        FX.showBanner(`NIVEL ${level}`, "perfect");
        FX.burst(150, 300, "#58a8b8", 24, 3);
      }
      updateSoloHUD();
    } else if (tspin) {
      score += E.computeClearScore(0, tspin, level, false).points;
      FX.showBanner(tspin === "mini" ? "T-SPIN MINI" : "T-SPIN", tspin === "mini" ? "mini" : "tspin");
      updateSoloHUD();
    }

    lastRotated = false;
    lastKickIndex = 0;
    current = E.spawnPiece(nextType);
    nextType = soloNext();
    canHold = true;
    lockDelay = 0;
    if (E.collides(grid, current)) endSoloGame();
  }

  function resetSolo() {
    grid = E.createGrid();
    bag = [];
    E.refillBag(bag);
    holdType = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    tspinCount = 0;
    backToBack = false;
    lastRotated = false;
    lastKickIndex = 0;
    dropInterval = 1000;
    dropAccumulator = 0;
    lockDelay = 0;
    softDropping = false;
    hardDropping = false;
    pendingScoreSave = false;
    nextType = soloNext();
    current = E.spawnPiece(soloNext());
    resetAutoBrain();
    FX.clear();
    updateSoloHUD();
  }

  function startSolo() {
    if (pendingScoreSave) commitScore();
    SFX.unlock();
    resetSolo();
    setState("playing");
    hideSoloOverlay();
    SFX.start();
    MUSIC.start();
    lastTime = performance.now();
  }

  function endSoloGame() {
    if (state === "over") return;
    setState("over");
    MUSIC.stop();
    SFX.gameOver();
    FX.burst(150, 300, "#b85048", 40, 4);
    FX.shake(soloBoardWrap);
    resetAutoBrain();

    if (gameMode === "auto") {
      pendingScoreSave = false;
      showSoloOverlay(
        "Fin del Auto",
        `El bot hizo ${score} pts · Líneas: ${lines} · T-Spins: ${tspinCount} · ${T.BOT_DIFF[botDiff].label}`,
        "Otra vez",
        { showName: false, showMiniRank: true, showModes: true }
      );
      return;
    }

    pendingScoreSave = Ranking.qualifies(score);
    const msg = pendingScoreSave
      ? `Puntos: ${score} · Líneas: ${lines} · T-Spins: ${tspinCount} — ¡Ranking!`
      : `Puntos: ${score} · Líneas: ${lines} · T-Spins: ${tspinCount}`;
    showSoloOverlay("Game Over", msg, "Otra vez", {
      showName: pendingScoreSave,
      showMiniRank: true,
      showModes: true,
    });
  }

  function commitScore() {
    if (!pendingScoreSave) return;
    const { entry } = Ranking.addEntry(playerNameInput.value, { score, lines, level });
    lastHighlightId = entry.id;
    pendingScoreSave = false;
    nameForm.classList.add("hidden");
    SFX.scoreSave();
    Ranking.renderSide(entry.id);
    Ranking.renderOverlayMini(entry.id);
    updateHighScoreDisplay();
    overlayMsg.textContent = `Guardado: ${entry.name} — ${entry.score} pts`;
  }

  function soloTryMove(dx, dy, { silent = false } = {}) {
    if (!E.collides(grid, current, dx, dy)) {
      current.x += dx;
      current.y += dy;
      if (dx !== 0) {
        lastRotated = false;
        lastKickIndex = 0;
      }
      if (dy > 0) lockDelay = 0;
      else if (E.collides(grid, current, 0, 1)) lockDelay = 0;
      if (!silent && dx !== 0) SFX.move();
      return true;
    }
    return false;
  }

  function soloTryRotate(dir) {
    if (current.type === "O") {
      lastRotated = true;
      lastKickIndex = 0;
      SFX.rotate();
      return true;
    }
    const kick = E.tryRotateOn(grid, current, dir);
    if (kick >= 0) {
      lastRotated = true;
      lastKickIndex = kick;
      lockDelay = 0;
      SFX.rotate();
      if (current.type === "T" && kick > 0) {
        FX.burst((current.x + 1.5) * 30, (current.y + 1.5) * 30, "#9868a8", 8, 1.8);
      }
      return true;
    }
    return false;
  }

  function soloHardDrop() {
    const fromY = current.y;
    let dropped = 0;
    while (soloTryMove(0, 1, { silent: true })) dropped++;
    score += dropped * 2;
    updateSoloHUD();
    hardDropping = true;
    if (dropped > 0) FX.hardDropTrail(current, fromY, 30);
    SFX.hardDrop();
    soloLock();
  }

  function soloHold() {
    if (!canHold || state !== "playing") return;
    canHold = false;
    lastRotated = false;
    lastKickIndex = 0;
    SFX.hold();
    if (holdType === null) {
      holdType = current.type;
      current = E.spawnPiece(nextType);
      nextType = soloNext();
    } else {
      const swap = holdType;
      holdType = current.type;
      current = E.spawnPiece(swap);
    }
    lockDelay = 0;
    if (E.collides(grid, current)) {
      if (!E.collides(grid, current, 0, -1)) current.y -= 1;
      else endSoloGame();
    }
  }

  // ——— Versus ———
  function resetVersus() {
    p = E.createSeat(false);
    b = E.createSeat(true);
    T.p = p;
    T.b = b;
    vsBotDriver.reset(T.BOT_DIFF[botDiff]);
    vsKoFeed.textContent = "";
    vsBotLabel.textContent = `BOT · ${T.BOT_DIFF[botDiff].label}`;
    const vsLabelBot = document.querySelector(".vs-label.bot");
    if (vsLabelBot) vsLabelBot.textContent = "BOT";
    updateVsHUD();
    showRematchButton(false);
  }

  function startVersus() {
    SFX.unlock();
    resetVersus();
    FX.clear();
    setState("playing");
    hideVsOverlay();
    SFX.start();
    MUSIC.start();
    lastTime = performance.now();
  }

  function endVersus(playerWon) {
    if (state === "over") return;
    setState("over");
    MUSIC.stop();
    if (playerWon) {
      SFX.win();
      FX.burst(120, 240, "#58a858", 36, 4);
      FX.showBanner("¡VICTORIA!", "perfect");
      showVsOverlay("¡Victoria!", `Derrotaste al bot (${T.BOT_DIFF[botDiff].label}). Enviado: ${p.sent}`, "Revancha", true);
    } else {
      SFX.gameOver();
      FX.burst(120, 240, "#b85048", 36, 4);
      FX.shake(vsPlayerWrap);
      showVsOverlay("Derrota", `El bot te superó. Tú enviaste ${p.sent} · Bot ${b.sent}`, "Reintentar", true);
    }
  }

  function resetOnline() {
    p = E.createSeat(false);
    b = E.createSeat(false);
    T.p = p;
    T.b = b;
    vsKoFeed.textContent = "";
    vsBotLabel.textContent = "ONLINE vs AMIGO";
    const vsLabelBot = document.querySelector(".vs-label.bot");
    if (vsLabelBot) vsLabelBot.textContent = "AMIGO";
    updateVsHUD();
    showRematchButton(false);
  }

  function startOnlineGame() {
    SFX.unlock();
    resetOnline();
    FX.clear();
    setState("playing");
    hideSoloOverlay();
    hideVsOverlay();
    showRematchButton(false);
    SFX.start();
    MUSIC.start();
    lastTime = performance.now();
    T.Online.startSync();
  }

  function endOnlineGame(playerWon, opts) {
    if (state === "over") return;
    opts = opts || {};
    setState("over");
    MUSIC.stop();
    if (T.Online) T.Online.stopSync();
    if (!opts.fromNet && !opts.disconnect && T.Online && T.Online.isConnected) {
      T.Online.sendGameOver(!!playerWon);
    }
    if (opts.disconnect) {
      SFX.gameOver();
      showVsOverlay(
        "Desconectado",
        (opts.reason || "Se perdió la conexión") +
          ` · Tú: ${p ? p.sent : 0} · Rival: ${b ? b.sent : 0}`,
        "Volver",
        false
      );
      showRematchButton(false);
      return;
    }
    if (playerWon) {
      SFX.win();
      FX.burst(120, 240, "#58a858", 36, 4);
      FX.showBanner("¡VICTORIA!", "perfect");
      showVsOverlay("¡Victoria!", `¡Le ganaste a tu amigo! Enviado: ${p ? p.sent : 0}`, "Volver", false);
    } else {
      SFX.gameOver();
      FX.burst(120, 240, "#b85048", 36, 4);
      FX.shake(vsPlayerWrap);
      showVsOverlay(
        "Derrota",
        `Tu amigo te ganó. Tú enviaste ${p ? p.sent : 0} · Él envió ${b ? b.sent : 0}`,
        "Volver",
        false
      );
    }
    showRematchButton(true);
  }

  function resetCoop() {
    p = E.createSeat(false);
    b = E.createSeat(false);
    boss = E.createSeat(true);
    T.p = p;
    T.b = b;
    T.boss = boss;
    bossDriver.reset(T.BOT_DIFF.hard);
    coopKoFeed.textContent = "";
    updateCoopHUD();
    showRematchButton(false);
  }

  function startCoopGame() {
    SFX.unlock();
    resetCoop();
    FX.clear();
    setState("playing");
    hideSoloOverlay();
    hideCoopOverlay();
    showRematchButton(false);
    SFX.start();
    MUSIC.start();
    lastTime = performance.now();
    T.Online.startSync();
  }

  function endCoopGame(playerWon, opts) {
    if (state === "over") return;
    opts = opts || {};
    setState("over");
    MUSIC.stop();
    if (T.Online) T.Online.stopSync();
    if (!opts.fromNet && !opts.disconnect && T.Online && T.Online.isConnected) {
      T.Online.sendGameOver(!!playerWon);
    }
    if (opts.disconnect) {
      SFX.gameOver();
      showCoopOverlay(
        "Desconectado",
        (opts.reason || "Se perdió la conexión con tu compañero") + ". Vuelve a conectar."
      );
      showRematchButton(false);
      return;
    }
    if (playerWon) {
      SFX.win();
      FX.burst(100, 200, "#58a858", 36, 4);
      FX.showBanner("¡VICTORIA!", "perfect");
      showCoopOverlay(
        "¡Victoria!",
        `¡Derrotaron al Boss! Tu daño: ${p ? p.sent : 0} · Amigo: ${b ? b.sent : 0}`
      );
    } else {
      SFX.gameOver();
      FX.burst(100, 200, "#b85048", 36, 4);
      FX.shake(coopP1Wrap);
      showCoopOverlay(
        "Derrota",
        `El Boss los aplastó. Daño del Boss (líneas): ${boss ? boss.lines : 0}`
      );
    }
    showRematchButton(true);
  }

  function updateCoopHUD() {
    if (!p || !b || !boss) return;
    coopP1Sent.textContent = String(p.sent);
    coopP2Sent.textContent = String(b.sent);
    coopBossDamage.textContent = String(boss.lines);
    
    coopP1Garbage.style.setProperty("--g", String(Math.min(100, p.pendingGarbage * 5)));
    coopP2Garbage.style.setProperty("--g", String(Math.min(100, b.pendingGarbage * 5)));
    coopBossGarbage.style.setProperty("--g", String(Math.min(100, boss.pendingGarbage * 5)));
  }

  function flashKoCoop(text) {
    coopKoFeed.textContent = text;
    coopKoFeed.classList.remove("flash");
    void coopKoFeed.offsetWidth;
    coopKoFeed.classList.add("flash");
  }

  // ——— UI overlays / modo ———
  function showSoloOverlay(title, msg, btnText, { showName = false, showMiniRank = false, showModes = false } = {}) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    btnStart.textContent = btnText;
    nameForm.classList.toggle("hidden", !showName);
    modePicker.classList.toggle("hidden", !showModes);
    if (showName) {
      playerNameInput.value = localStorage.getItem(T.NAME_KEY) || "";
      setTimeout(() => playerNameInput.focus(), 50);
    }
    if (showMiniRank) Ranking.renderOverlayMini(lastHighlightId);
    else {
      const or = $("overlay-ranking");
      if (or) {
        or.classList.add("hidden");
        or.innerHTML = "";
      }
    }
    syncDiffButtons();
    overlay.classList.remove("hidden");
  }

  function hideSoloOverlay() {
    overlay.classList.add("hidden");
    nameForm.classList.add("hidden");
    $("overlay-ranking")?.classList.add("hidden");
    modePicker.classList.add("hidden");
  }

  function showVsOverlay(title, msg, btnText, showDiff) {
    vsOverlayTitle.textContent = title;
    vsOverlayMsg.textContent = msg;
    btnVsStart.textContent = btnText;
    vsOverlayDiff.classList.toggle("hidden", !showDiff);
    syncDiffButtons();
    vsOverlay.classList.remove("hidden");
  }

  function hideVsOverlay() {
    vsOverlay.classList.add("hidden");
  }

  function showCoopOverlay(title, msg) {
    coopOverlayTitle.textContent = title;
    coopOverlayMsg.textContent = msg;
    syncDiffButtons();
    coopOverlay.classList.remove("hidden");
  }

  function hideCoopOverlay() {
    coopOverlay.classList.add("hidden");
  }

  function syncDiffButtons() {
    document.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.diff === botDiff);
    });
    document.querySelectorAll(".mode-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === gameMode);
    });
    const needDiff = (gameMode === "versus" || gameMode === "auto") && state !== "playing";
    vsDiffPicker.classList.toggle("hidden", !needDiff || state === "playing");
    
    // Conexión Online panel show/hide
    const onlinePanel = $("online-conn-panel");
    if (onlinePanel) {
      onlinePanel.classList.toggle("hidden", (gameMode !== "online" && gameMode !== "coop") || state === "playing");
    }
    
    // Ocultar botón start en menú online/coop (se inicia por sincronización P2P)
    btnStart.classList.toggle("hidden", gameMode === "online" || gameMode === "coop");
    btnVsStart.classList.toggle("hidden", gameMode === "online" || gameMode === "coop");

    // En overlay solo: mostrar diff si auto y hay mode picker o menú
    if (gameMode === "auto" && state !== "playing" && usesSoloLayout()) {
      vsDiffPicker.classList.remove("hidden");
    }
    if (gameMode === "solo" || gameMode === "online" || gameMode === "coop") {
      vsDiffPicker.classList.add("hidden");
    }
    const diffLabel = $("diff-label");
    if (diffLabel) {
      diffLabel.textContent =
        gameMode === "auto" ? "Nivel del bot (auto)" : "Dificultad del bot";
    }
    btnMode.textContent = modeLabel();
    btnMode.classList.toggle("versus", gameMode === "versus");
    btnMode.classList.toggle("auto", gameMode === "auto");
    btnMode.classList.toggle("online", gameMode === "online" || gameMode === "coop");
    if (subtitle) subtitle.textContent = subtitleForMode();
  }

  function setBotDiff(d) {
    if (!T.BOT_DIFF[d]) return;
    botDiff = d;
    localStorage.setItem(T.DIFF_KEY, d);
    vsBotLabel.textContent = `BOT · ${T.BOT_DIFF[botDiff].label}`;
    syncDiffButtons();
    SFX.ui();
  }

  function setGameMode(mode) {
    if (mode !== "solo" && mode !== "auto" && mode !== "versus" && mode !== "online" && mode !== "coop") return;
    
    // Apagar conexión online si cambiamos de modo
    if ((gameMode === "online" || gameMode === "coop") && (mode !== "online" && mode !== "coop") && T.Online) {
      T.Online.shutdown();
    }
    
    setMode(mode);
    const isVs = mode === "versus" || mode === "online";
    const isCoop = mode === "coop";
    layoutSolo.classList.toggle("hidden", isVs || isCoop);
    layoutVersus.classList.toggle("hidden", !isVs);
    layoutCoop.classList.toggle("hidden", !isCoop);
    MUSIC.stop();
    FX.clear();
    resetAutoBrain();
    setState("menu");
    
    // Mover el panel de conexión al overlay activo
    const connPanel = $("online-conn-panel");
    if (connPanel) {
      if (mode === "coop") {
        $("coop-overlay-card").insertBefore(connPanel, $("btn-coop-back"));
      } else if (mode === "online") {
        $("vs-overlay-card").insertBefore(connPanel, $("btn-back-solo"));
      }
    }

    if (mode === "online") {
      resetOnline();
      if (T.Online) T.Online.init();
      showVsOverlay("Modo Online", "Copia tu código para tu amigo o ingresa el suyo.", "Jugar", false);
    } else if (mode === "coop") {
      resetCoop();
      if (T.Online) T.Online.init();
      showCoopOverlay("Modo Cooperativo", "Copia tu código para tu amigo o ingresa el suyo para jugar 2v1 contra el Boss.");
    } else if (isVs) {
      resetVersus();
      showVsOverlay("Versus BOT", "Limpia líneas para enviar basura. El primero en top-out pierde.", "Desafiar BOT", true);
    } else {
      grid = E.createGrid();
      current = null;
      nextType = null;
      holdType = null;
      const title = mode === "auto" ? "Modo Auto" : "Tetris";
      const msg =
        mode === "auto"
          ? "El bot juega por ti. Elige nivel y pulsa Jugar."
          : "Elige modo y pulsa Jugar";
      const btn = mode === "auto" ? "Ver al bot" : "Jugar";
      showSoloOverlay(title, msg, btn, {
        showModes: true,
        showMiniRank: true,
      });
    }
    syncDiffButtons();
    drawAll();
  }

  // ——— Ticks ———
  function makeSeatBotApi(seat, opponent, onDeadCheck) {
    return {
      isAlive: () => seat && !seat.dead && state === "playing" && seat.current,
      getPiece: () => seat.current,
      getGrid: () => seat.grid,
      isGrounded: () => E.collides(seat.grid, seat.current, 0, 1),
      gravityStep: () => seatTryMove(seat, 0, 1),
      tryMove: (dx, dy) => seatTryMove(seat, dx, dy),
      tryRotateCW: () => {
        const kick = E.tryRotateOn(seat.grid, seat.current, 1);
        if (kick >= 0) {
          seat.lastRotated = true;
          seat.lastKickIndex = kick;
        }
        return kick;
      },
      hardDropAndLock: () => {
        while (seatTryMove(seat, 0, 1));
        seat.hardDropping = true;
        seatLock(seat, opponent, { playSfx: false });
        if (onDeadCheck) onDeadCheck();
      },
    };
  }

  function tickBot(dt) {
    if (!b || b.dead || state !== "playing") return;
    const cfg = T.BOT_DIFF[botDiff];

    // Lock delay si está en el suelo sin plan de drop inmediato
    if (E.collides(b.grid, b.current, 0, 1)) {
      b.lockDelay += dt;
      if (b.lockDelay >= T.LOCK_MS) {
        seatLock(b, p, { playSfx: false });
        vsBotDriver.reset(cfg);
        b.dropAccumulator = 0;
        b.lockDelay = 0;
        if (b.dead) endVersus(true);
        return;
      }
    } else {
      b.lockDelay = 0;
    }

    vsBotDriver.tick(
      dt,
      cfg,
      makeSeatBotApi(b, p, () => {
        if (b.dead) endVersus(true);
        else if (p && p.dead) endVersus(false);
      })
    );
  }

  function tickBoss(dt) {
    if (!boss || boss.dead || state !== "playing") return;
    // cfg completo (noise/mistakeChance) — sin esto la IA se sesgaba a un muro
    const cfg = {
      thinkMs: [80, 160],
      moveMs: 40,
      dropInterval: 360,
      mistakeChance: 0.03,
      noise: 3,
    };

    if (E.collides(boss.grid, boss.current, 0, 1)) {
      boss.lockDelay += dt;
      if (boss.lockDelay >= T.LOCK_MS) {
        seatLock(boss, null, { playSfx: false });
        bossDriver.reset(cfg);
        boss.dropAccumulator = 0;
        boss.lockDelay = 0;
        if (boss.dead) endCoopGame(true);
        return;
      }
    } else {
      boss.lockDelay = 0;
    }

    bossDriver.tick(
      dt,
      cfg,
      makeSeatBotApi(boss, null, () => {
        if (boss.dead) endCoopGame(true);
      })
    );
  }

  function tickPlayerVs(dt) {
    if (!p || p.dead || state !== "playing") return;
    const interval = softDropping ? T.SOFT_DROP_INTERVAL : 700;
    p.dropAccumulator += dt;
    if (E.collides(p.grid, p.current, 0, 1)) {
      p.lockDelay += dt;
      if (p.lockDelay >= T.LOCK_MS) {
        seatLock(p, gameMode === "coop" ? boss : b, { playSfx: true });
        p.dropAccumulator = 0;
        p.lockDelay = 0;
        if (p.dead) {
          if (gameMode === "coop") {
            if (b && b.dead) endCoopGame(false);
          } else if (gameMode === "online") {
            endOnlineGame(false);
          } else {
            endVersus(false);
          }
        } else if (b && b.dead && gameMode !== "coop") {
          if (gameMode === "online") endOnlineGame(true);
          else endVersus(true);
        }
      }
    } else {
      p.lockDelay = 0;
      while (p.dropAccumulator >= interval) {
        p.dropAccumulator -= interval;
        if (!seatTryMove(p, 0, 1)) break;
      }
    }
  }

  function tickSolo(dt) {
    if (state !== "playing" || !current) return;
    const interval = softDropping ? Math.min(dropInterval, T.SOFT_DROP_INTERVAL) : dropInterval;
    dropAccumulator += dt;
    if (E.collides(grid, current, 0, 1)) {
      lockDelay += dt;
      if (lockDelay >= T.LOCK_MS) {
        soloLock();
        dropAccumulator = 0;
        lockDelay = 0;
      }
    } else {
      lockDelay = 0;
      while (dropAccumulator >= interval) {
        dropAccumulator -= interval;
        if (soloTryMove(0, 1, { silent: true })) {
          if (softDropping) {
            score += 1;
            updateSoloHUD();
          }
        } else break;
      }
    }
  }

  /** El bot controla el tablero clásico (modo espectador). */
  function tickAuto(dt) {
    if (state !== "playing" || !current) return;
    const cfg = T.BOT_DIFF[botDiff];

    if (E.collides(grid, current, 0, 1)) {
      lockDelay += dt;
      if (lockDelay >= T.LOCK_MS) {
        soloLock();
        dropAccumulator = 0;
        lockDelay = 0;
        resetAutoBrain();
        return;
      }
    } else {
      lockDelay = 0;
    }

    autoDriver.tick(dt, cfg, {
      isAlive: () => state === "playing" && !!current,
      getPiece: () => current,
      getGrid: () => grid,
      isGrounded: () => E.collides(grid, current, 0, 1),
      gravityStep: () => soloTryMove(0, 1, { silent: true }),
      tryMove: (dx, dy) => {
        const ok = soloTryMove(dx, dy, { silent: true });
        if (ok && dx !== 0) SFX.move();
        return ok;
      },
      tryRotateCW: () => {
        if (current.type === "O") {
          lastRotated = true;
          lastKickIndex = 0;
          SFX.rotate();
          return 0;
        }
        const kick = E.tryRotateOn(grid, current, 1);
        if (kick >= 0) {
          lastRotated = true;
          lastKickIndex = kick;
          lockDelay = 0;
          SFX.rotate();
        }
        return kick;
      },
      hardDropAndLock: () => {
        const fromY = current.y;
        let dropped = 0;
        while (soloTryMove(0, 1, { silent: true })) dropped++;
        hardDropping = true;
        if (dropped > 0) FX.hardDropTrail(current, fromY, 30);
        SFX.hardDrop();
        soloLock();
        resetAutoBrain();
      },
    });
  }

  function drawAll() {
    if (usesSoloLayout()) {
      R.drawField(boardCtx, boardCanvas, grid, state === "menu" ? null : current, 30, state === "playing" || state === "paused", {
        withFx: true,
      });
      R.drawMini(holdCtx, holdCanvas, holdType, !canHold && state === "playing");
      R.drawMini(nextCtx, nextCanvas, nextType);
    } else if (gameMode === "coop") {
      const showPieces = state === "playing" || state === "paused" || state === "over";
      R.drawField(
        coopP1BoardCtx,
        coopP1BoardCanvas,
        p ? p.grid : E.createGrid(),
        showPieces && p ? p.current : null,
        20,
        state === "playing" || state === "paused",
        { withFx: true }
      );
      R.drawField(
        coopP2BoardCtx,
        coopP2BoardCanvas,
        b ? b.grid : E.createGrid(),
        showPieces && b ? b.current : null,
        20,
        false
      );
      R.drawField(
        coopBossBoardCtx,
        coopBossBoardCanvas,
        boss ? boss.grid : E.createGrid(),
        showPieces && boss ? boss.current : null,
        20,
        false
      );
      R.drawMini(coopP1HoldCtx, coopP1HoldCanvas, p ? p.holdType : null, p && !p.canHold && state === "playing");
      R.drawMini(coopP1NextCtx, coopP1NextCanvas, p ? p.nextType : null);
      R.drawMini(coopP2HoldCtx, coopP2HoldCanvas, b ? b.holdType : null);
      R.drawMini(coopP2NextCtx, coopP2NextCanvas, b ? b.nextType : null);
      R.drawMini(coopBossNextCtx, coopBossNextCanvas, boss ? boss.nextType : null);
    } else {
      const showPieces = state === "playing" || state === "paused" || state === "over";
      R.drawField(
        vsBoardCtx,
        vsBoardCanvas,
        p ? p.grid : E.createGrid(),
        showPieces && p ? p.current : null,
        24,
        state === "playing" || state === "paused",
        { withFx: true }
      );
      R.drawField(botBoardCtx, botBoardCanvas, b ? b.grid : E.createGrid(), showPieces && b ? b.current : null, 24, false);
      R.drawMini(vsHoldCtx, vsHoldCanvas, p ? p.holdType : null, p && !p.canHold && state === "playing");
      R.drawMini(vsNextCtx, vsNextCanvas, p ? p.nextType : null);
      R.drawMini(botNextCtx, botNextCanvas, b ? b.nextType : null);
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(50, now - lastTime);
    lastTime = now;
    if (state === "playing") {
      if (gameMode === "solo") tickSolo(dt);
      else if (gameMode === "auto") tickAuto(dt);
      else if (gameMode === "coop") {
        tickPlayerVs(dt);
        if (T.Online && T.Online.isHost) {
          tickBoss(dt);
        }
        updateCoopHUD();
      } else {
        tickPlayerVs(dt);
        if (gameMode === "versus") tickBot(dt);
        updateVsHUD();
      }
    }
    FX.update(dt);
    drawAll();
  }

  // ——— Input ———
  const keysDown = new Set();
  let dasTimer = null;
  let arrTimer = null;
  let dasDir = 0;

  function stopRepeat() {
    if (dasTimer) clearTimeout(dasTimer);
    if (arrTimer) clearInterval(arrTimer);
    dasTimer = null;
    arrTimer = null;
    dasDir = 0;
  }

  function doMove(dir) {
    if (state !== "playing") return;
    if (gameMode === "solo") soloTryMove(dir, 0);
    else if (p && !p.dead && seatTryMove(p, dir, 0)) SFX.move();
  }

  function startRepeat(dir) {
    stopRepeat();
    dasDir = dir;
    doMove(dir);
    dasTimer = setTimeout(() => {
      doMove(dir);
      arrTimer = setInterval(() => doMove(dir), T.ARR);
    }, T.DAS);
  }

  function togglePause() {
    if (state === "playing") {
      setState("paused");
      MUSIC.pause();
      SFX.pause();
      if (usesSoloLayout()) showSoloOverlay("Pausa", "Pulsa P, Esc o Enter para continuar", "Continuar");
      else showVsOverlay("Pausa", "Pulsa P, Esc o Enter para continuar", "Continuar", false);
    } else if (state === "paused") {
      setState("playing");
      SFX.unpause();
      MUSIC.resume();
      if (usesSoloLayout()) hideSoloOverlay();
      else hideVsOverlay();
      lastTime = performance.now();
      dropAccumulator = 0;
      if (p) p.dropAccumulator = 0;
    }
  }

  function toggleMute() {
    SFX.setMuted(!SFX.isMuted());
    updateMuteButton();
    if (!SFX.isMuted()) {
      SFX.ui();
      if (state === "playing") MUSIC.start();
    }
  }

  function openRankingModal() {
    SFX.ui();
    Ranking.renderModal(lastHighlightId);
    rankingModal.classList.remove("hidden");
  }

  function closeRankingModal() {
    rankingModal.classList.add("hidden");
  }

  function onKeyDown(e) {
    const key = e.key;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (key === "Enter" && pendingScoreSave && state === "over" && gameMode === "solo") {
        e.preventDefault();
        commitScore();
      }
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Spacebar"].includes(key)) e.preventDefault();

    if (!rankingModal.classList.contains("hidden")) {
      if (key === "Escape" || key === "r" || key === "R") {
        e.preventDefault();
        closeRankingModal();
      }
      return;
    }

    if (key === "m" || key === "M") {
      toggleMute();
      return;
    }
    if (key === "r" || key === "R") {
      if (state !== "playing") openRankingModal();
      return;
    }
    if (key === "v" || key === "V") {
      if (state === "menu" || state === "over") {
        setGameMode(nextMode(gameMode));
        SFX.ui();
      }
      return;
    }

    if (key === "Enter" || key === " ") {
      if (state === "menu" || state === "over") {
        if (gameMode === "online" || gameMode === "coop") return;
        if (usesSoloLayout()) {
          if (state === "over" && pendingScoreSave && key === "Enter") {
            commitScore();
            return;
          }
          startSolo();
        } else startVersus();
        return;
      }
      if (state === "paused") {
        togglePause();
        return;
      }
    }

    if (key === "p" || key === "P" || key === "Escape") {
      if (state === "playing" || state === "paused") togglePause();
      return;
    }

    if (state !== "playing" || gameMode === "auto") return;
    if (keysDown.has(key) && !["ArrowLeft", "ArrowRight"].includes(key)) return;
    keysDown.add(key);

    switch (key) {
      case "ArrowLeft":
        if (dasDir !== -1) startRepeat(-1);
        break;
      case "ArrowRight":
        if (dasDir !== 1) startRepeat(1);
        break;
      case "ArrowDown":
        if (!softDropping) {
          softDropping = true;
          if (gameMode === "solo") {
            if (soloTryMove(0, 1)) {
              score += 1;
              updateSoloHUD();
            }
            dropAccumulator = 0;
          } else if (p && !p.dead) {
            if (seatTryMove(p, 0, 1)) SFX.move();
            p.dropAccumulator = 0;
          }
        }
        break;
      case "ArrowUp":
      case "x":
      case "X":
        if (gameMode === "solo") soloTryRotate(1);
        else if (p) {
          const kick = E.tryRotateOn(p.grid, p.current, 1);
          if (kick >= 0) {
            p.lastRotated = true;
            p.lastKickIndex = kick;
            p.lockDelay = 0;
            SFX.rotate();
            if (p.current.type === "T" && kick > 0) {
              FX.burst((p.current.x + 1.5) * 24, (p.current.y + 1.5) * 24, "#9868a8", 8, 1.8);
            }
          }
        }
        break;
      case "z":
      case "Z":
        if (gameMode === "solo") soloTryRotate(-1);
        else if (p) {
          const kick = E.tryRotateOn(p.grid, p.current, -1);
          if (kick >= 0) {
            p.lastRotated = true;
            p.lastKickIndex = kick;
            p.lockDelay = 0;
            SFX.rotate();
          }
        }
        break;
      case " ":
      case "Spacebar":
        if (gameMode === "solo") soloHardDrop();
        else if (p && !p.dead) {
          const fromY = p.current.y;
          let dropped = 0;
          while (seatTryMove(p, 0, 1)) dropped++;
          p.hardDropping = true;
          const block = gameMode === "coop" ? 20 : 24;
          if (dropped > 0) FX.hardDropTrail(p.current, fromY, block);
          SFX.hardDrop();
          const opponent = gameMode === "coop" ? boss : b;
          seatLock(p, opponent, { playSfx: true });
          if (p.dead) {
            if (gameMode === "coop") {
              if (b && b.dead) endCoopGame(false);
            } else if (gameMode === "online") endOnlineGame(false);
            else endVersus(false);
          } else if (gameMode === "coop" && boss && boss.dead) {
            endCoopGame(true);
          } else if (b && b.dead && gameMode !== "coop") {
            if (gameMode === "online") endOnlineGame(true);
            else endVersus(true);
          }
        }
        break;
      case "c":
      case "C":
      case "Shift":
        if (gameMode === "solo") soloHold();
        else if (p) seatHold(p);
        break;
    }
  }

  function onKeyUp(e) {
    keysDown.delete(e.key);
    if (e.key === "ArrowLeft" && dasDir === -1) stopRepeat();
    if (e.key === "ArrowRight" && dasDir === 1) stopRepeat();
    if (e.key === "ArrowDown") softDropping = false;
  }

  // ——— Events ———
  btnStart.addEventListener("click", () => {
    SFX.unlock();
    if (state === "menu" || state === "over") startSolo();
    else if (state === "paused") togglePause();
  });
  btnVsStart.addEventListener("click", () => {
    SFX.unlock();
    if (state === "menu" || state === "over") startVersus();
    else if (state === "paused") togglePause();
  });
  btnBackSolo.addEventListener("click", () => {
    if (state === "playing") return;
    setGameMode("solo");
    SFX.ui();
  });
  btnCoopBack.addEventListener("click", () => {
    if (state === "playing") return;
    setGameMode("solo");
    SFX.ui();
  });
  btnMode.addEventListener("click", () => {
    if (state === "playing") return;
    setGameMode(nextMode(gameMode));
    SFX.ui();
  });
  modePicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-option");
    if (!btn) return;
    setGameMode(btn.dataset.mode);
    SFX.ui();
  });
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => setBotDiff(btn.dataset.diff));
  });
  btnSaveScore.addEventListener("click", () => commitScore());
  btnMute.addEventListener("click", () => {
    SFX.unlock();
    toggleMute();
  });
  btnRanking.addEventListener("click", openRankingModal);
  btnCloseRanking.addEventListener("click", closeRankingModal);
  btnCloseRanking2.addEventListener("click", closeRankingModal);
  rankingModal.addEventListener("click", (e) => {
    if (e.target === rankingModal) closeRankingModal();
  });
  btnClearRanking.addEventListener("click", () => {
    if (!Ranking.load().length) return;
    if (!confirm("¿Borrar todo el ranking local?")) return;
    Ranking.clear();
    lastHighlightId = null;
    Ranking.renderSide();
    Ranking.renderModal();
    updateHighScoreDisplay();
    SFX.ui();
  });

  const unlockOnce = () => {
    SFX.unlock();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ——— Init ———
  updateMuteButton();
  updateHighScoreDisplay();
  Ranking.renderSide();
  syncDiffButtons();
  showSoloOverlay("Tetris", "Elige modo y pulsa Jugar", "Jugar", {
    showModes: true,
    showMiniRank: true,
  });
  drawAll();
  lastTime = performance.now();
  T.p = p;
  T.b = b;
  T.boss = boss;
  T.updateGarbageMeters = updateGarbageMeters;
  T.startOnlineGame = startOnlineGame;
  T.endOnlineGame = endOnlineGame;
  T.startCoopGame = startCoopGame;
  T.endCoopGame = endCoopGame;

  T.onOnlineDisconnect = function onOnlineDisconnect(info) {
    info = info || {};
    if (!info.wasPlaying || state !== "playing") return;
    if (gameMode === "coop") {
      endCoopGame(false, { disconnect: true, reason: info.reason });
    } else if (gameMode === "online") {
      endOnlineGame(false, { disconnect: true, reason: info.reason });
    }
  };

  T.onOnlineRemoteSync = function onOnlineRemoteSync() {
    if (gameMode === "coop") updateCoopHUD();
    else if (gameMode === "online") updateVsHUD();
  };

  T.onOnlineGarbage = function onOnlineGarbage(lines) {
    if (gameMode === "coop") flashKoCoop("¡BASURA +" + lines + "!");
    else flashKo("¡BASURA +" + lines + "!");
  };

  requestAnimationFrame(loop);
})(window.Tetris);
