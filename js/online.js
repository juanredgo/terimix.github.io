/**
 * Red P2P (PeerJS): salas, heartbeat, reconexión, sync con secuencia y basura fiable.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const SYNC_MS = 45;
  const HEARTBEAT_MS = 1500;
  const STALE_MS = 4500;
  const DEAD_MS = 12000;
  const RECONNECT_TRIES = 6;
  const RECONNECT_GAP_MS = 1800;
  const GARBAGE_SEEN_MAX = 80;

  const Online = {
    peer: null,
    conn: null,
    myId: "",
    friendId: "",
    lastFriendId: "",
    isHost: false,
    isConnected: false,
    isPlaying: false,
    wantReconnect: false,
    rttMs: null,
    lagLabel: "—",
    seqOut: 0,
    remoteSeq: 0,
    garbageIdOut: 0,
    garbageSeen: [],
    syncIntervalId: null,
    heartbeatId: null,
    reconnectId: null,
    reconnectAttempts: 0,
    lastPongAt: 0,
    lastRecvAt: 0,
    startPending: false,
  };

  const statusEl = () => document.getElementById("online-status");
  const myPeerIdEl = () => document.getElementById("my-peer-id");
  const friendInputEl = () => document.getElementById("friend-peer-id");
  const connectBtnEl = () => document.getElementById("btn-connect-online");
  const lagEl = () => document.getElementById("online-lag");
  const reconnectBtnEl = () => document.getElementById("btn-reconnect-online");

  function setStatus(text, type) {
    const el = statusEl();
    if (!el) return;
    el.textContent = text;
    el.className = "online-status";
    if (type) el.classList.add(type);
  }

  function setLagDisplay() {
    const el = lagEl();
    if (!el) return;
    if (Online.rttMs == null) {
      el.textContent = "Ping: —";
      el.classList.remove("ok", "warn", "bad");
      return;
    }
    const ms = Math.round(Online.rttMs);
    Online.lagLabel = ms + " ms";
    el.textContent = "Ping: " + Online.lagLabel;
    el.classList.remove("ok", "warn", "bad");
    if (ms < 80) el.classList.add("ok");
    else if (ms < 180) el.classList.add("warn");
    else el.classList.add("bad");
  }

  function generateRoomId() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function currentMode() {
    return T.gameMode === "coop" ? "coop" : "online";
  }

  /** Payload de arranque: el host impone dificultad del boss (y seed). */
  function buildStartPayload(extra) {
    const payload = {
      type: "start",
      mode: currentMode(),
      seed: Date.now(),
    };
    if (T.gameMode === "coop") {
      payload.bossDiff =
        (typeof T.getBossDiff === "function" && T.getBossDiff()) ||
        T.bossDiff ||
        "normal";
    }
    if (extra && typeof extra === "object") {
      for (const k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
      }
    }
    return payload;
  }

  function isNetMode() {
    return T.gameMode === "online" || T.gameMode === "coop";
  }

  function updateReconnectUi() {
    const btn = reconnectBtnEl();
    if (!btn) return;
    const show =
      isNetMode() &&
      !Online.isConnected &&
      !!Online.lastFriendId &&
      !Online.isHost;
    btn.classList.toggle("hidden", !show);
  }

  function rememberFriend(id) {
    if (!id) return;
    Online.friendId = id;
    Online.lastFriendId = id;
    const input = friendInputEl();
    if (input && !input.value) input.value = id;
  }

  Online.init = function init() {
    if (Online.peer) {
      if (Online.peer.destroyed) {
        Online.peer = null;
      } else {
        setStatus(
          Online.isConnected
            ? "Conectado"
            : "Listo · comparte tu código o introduce el del amigo",
          Online.isConnected ? "success" : "success"
        );
        updateReconnectUi();
        return;
      }
    }

    Online.myId = generateRoomId();
    const idEl = myPeerIdEl();
    if (idEl) idEl.textContent = Online.myId;
    setStatus("Conectando a PeerServer...", "warn");
    setLagDisplay();

    Online.peer = new Peer(Online.myId, { debug: 0 });

    Online.peer.on("open", (id) => {
      Online.myId = id;
      if (idEl) idEl.textContent = id;
      setStatus("Sala lista · comparte tu código o conecta al amigo", "success");
      updateReconnectUi();
    });

    Online.peer.on("disconnected", () => {
      setStatus("Señal PeerJS perdida · reintentando...", "warn");
      try {
        if (Online.peer && !Online.peer.destroyed) Online.peer.reconnect();
      } catch (_) {
        /* ignore */
      }
    });

    Online.peer.on("error", (err) => {
      console.error("PeerJS Error:", err);
      if (err.type === "unavailable-id" || err.type === "invalid-id") {
        try {
          Online.peer.destroy();
        } catch (_) {}
        Online.peer = null;
        setTimeout(Online.init, 400);
        return;
      }
      if (err.type === "peer-unavailable") {
        setStatus("Ese código no está en línea", "error");
        Online.isHost = false;
        return;
      }
      if (err.type === "network") {
        setStatus("Error de red P2P", "error");
        return;
      }
      setStatus("Error P2P: " + (err.type || "desconocido"), "error");
    });

    Online.peer.on("connection", (c) => {
      // Host: aceptar solo si no hay conn abierta (permite reconexión tras close)
      if (Online.conn && Online.conn.open) {
        c.close();
        return;
      }
      if (Online.conn) {
        try {
          Online.conn.close();
        } catch (_) {}
        Online.conn = null;
      }
      Online.isHost = true;
      Online.setupConnection(c, { asHost: true });
    });
  };

  Online.setupConnection = function setupConnection(c, opts) {
    opts = opts || {};
    Online.conn = c;
    rememberFriend(c.peer);
    Online.wantReconnect = true;
    Online.reconnectAttempts = 0;
    clearReconnectTimer();

    c.on("open", () => {
      Online.isConnected = true;
      Online.lastPongAt = performance.now();
      Online.lastRecvAt = performance.now();
      Online.remoteSeq = 0;
      Online.seqOut = 0;
      Online.garbageSeen = [];
      setStatus("¡Conectado! Sincronizando modo...", "success");
      if (T.SFX) T.SFX.scoreSave();
      updateReconnectUi();
      startHeartbeat();

      // Handshake: ambos envían hello; el host arranca si modos coinciden
      Online.send({
        type: "hello",
        mode: currentMode(),
        host: !!Online.isHost,
        room: Online.myId,
      });

      if (typeof T.onOnlineConnected === "function") {
        T.onOnlineConnected({ isHost: Online.isHost, friendId: Online.friendId });
      }
    });

    c.on("data", (data) => {
      Online.lastRecvAt = performance.now();
      Online.handleMessage(data);
    });

    c.on("close", () => {
      onLinkLost("Conexión cerrada");
    });

    c.on("error", (err) => {
      console.error("Connection error:", err);
      onLinkLost("Error de enlace");
    });
  };

  function onLinkLost(reason) {
    const wasPlaying = Online.isPlaying;
    const wasConnected = Online.isConnected;
    Online.isConnected = false;
    Online.conn = null;
    stopHeartbeat();
    Online.stopSync();
    setLagDisplay();
    updateReconnectUi();

    if (wasPlaying && typeof T.onOnlineDisconnect === "function") {
      T.onOnlineDisconnect({ reason: reason || "Desconectado", wasPlaying: true });
    }

    if (Online.wantReconnect && Online.lastFriendId && !Online.isHost) {
      setStatus((reason || "Desconectado") + " · reintentando...", "warn");
      scheduleReconnect();
    } else if (Online.wantReconnect && Online.isHost) {
      setStatus((reason || "Rival desconectado") + " · esperando reconexión...", "warn");
    } else {
      setStatus(reason || "Desconectado", "error");
    }

    if (wasConnected && !wasPlaying && typeof T.onOnlineDisconnect === "function") {
      // menú: solo aviso
    }
  }

  function clearReconnectTimer() {
    if (Online.reconnectId) {
      clearTimeout(Online.reconnectId);
      Online.reconnectId = null;
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    if (Online.reconnectAttempts >= RECONNECT_TRIES) {
      setStatus("No se pudo reconectar. Pide el código de nuevo.", "error");
      updateReconnectUi();
      return;
    }
    Online.reconnectAttempts++;
    Online.reconnectId = setTimeout(() => {
      Online.reconnectId = null;
      Online.tryReconnect();
    }, RECONNECT_GAP_MS);
  }

  Online.tryReconnect = function tryReconnect() {
    if (Online.isConnected) return;
    if (!Online.lastFriendId) {
      setStatus("No hay código de amigo guardado", "error");
      return;
    }
    if (!Online.peer || !Online.peer.open) {
      setStatus("Reiniciando peer...", "warn");
      Online.init();
      scheduleReconnect();
      return;
    }
    setStatus(
      "Reconectando a " + Online.lastFriendId + " (" + Online.reconnectAttempts + "/" + RECONNECT_TRIES + ")...",
      "warn"
    );
    Online.isHost = false;
    try {
      const c = Online.peer.connect(Online.lastFriendId, {
        reliable: true,
        serialization: "json",
      });
      Online.setupConnection(c, { asHost: false });
    } catch (err) {
      console.error(err);
      scheduleReconnect();
    }
  };

  Online.connectToFriend = function connectToFriend(manualId) {
    const input = friendInputEl();
    const targetId = String(manualId || (input && input.value) || "")
      .trim()
      .replace(/\s/g, "");
    if (!targetId || targetId.length !== 6 || isNaN(Number(targetId))) {
      setStatus("Código inválido (6 dígitos)", "error");
      return;
    }
    if (targetId === Online.myId) {
      setStatus("Ese es tu propio código", "error");
      return;
    }
    if (!Online.peer || !Online.peer.open) {
      setStatus("Peer no listo. Espera un segundo...", "warn");
      Online.init();
      return;
    }
    if (Online.conn && Online.conn.open) {
      setStatus("Ya estás conectado", "success");
      return;
    }

    Online.wantReconnect = true;
    Online.reconnectAttempts = 0;
    rememberFriend(targetId);
    setStatus("Conectando a sala " + targetId + "...", "warn");
    Online.isHost = false;
    const c = Online.peer.connect(targetId, {
      reliable: true,
      serialization: "json",
    });
    Online.setupConnection(c, { asHost: false });
  };

  Online.send = function send(data) {
    if (Online.conn && Online.conn.open) {
      try {
        Online.conn.send(data);
      } catch (err) {
        console.error("send failed", err);
      }
    }
  };

  function seenGarbage(id) {
    if (id == null) return false;
    if (Online.garbageSeen.indexOf(id) !== -1) return true;
    Online.garbageSeen.push(id);
    if (Online.garbageSeen.length > GARBAGE_SEEN_MAX) {
      Online.garbageSeen.splice(0, Online.garbageSeen.length - GARBAGE_SEEN_MAX);
    }
    return false;
  }

  function seatSnapshot(seat) {
    if (!seat) return null;
    return {
      grid: seat.grid,
      current: seat.current,
      holdType: seat.holdType,
      nextType: seat.nextType,
      lines: seat.lines,
      sent: seat.sent,
      dead: !!seat.dead,
      pendingGarbage: seat.pendingGarbage || 0,
      canHold: seat.canHold,
    };
  }

  function applySeatSnapshot(seat, snap) {
    if (!seat || !snap) return;
    if (snap.grid) seat.grid = snap.grid;
    if (snap.current) seat.current = snap.current;
    if ("holdType" in snap) seat.holdType = snap.holdType;
    if ("nextType" in snap) seat.nextType = snap.nextType;
    if ("lines" in snap) seat.lines = snap.lines;
    if ("sent" in snap) seat.sent = snap.sent;
    if ("dead" in snap) seat.dead = !!snap.dead;
    if ("pendingGarbage" in snap) seat.pendingGarbage = snap.pendingGarbage;
    if ("canHold" in snap) seat.canHold = snap.canHold;
  }

  Online.handleMessage = function handleMessage(msg) {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "hello": {
        if (msg.mode && msg.mode !== currentMode()) {
          setStatus(
            "Modo distinto: tú en " + currentMode() + ", amigo en " + msg.mode,
            "error"
          );
          Online.send({ type: "hello_nack", mode: currentMode(), want: msg.mode });
          return;
        }
        Online.send({
          type: "hello_ack",
          mode: currentMode(),
          host: !!Online.isHost,
          bossDiff:
            T.gameMode === "coop"
              ? (typeof T.getBossDiff === "function" && T.getBossDiff()) || T.bossDiff || "normal"
              : undefined,
        });
        // Solo el host lanza la partida (una vez)
        if (Online.isHost && !Online.isPlaying && !Online.startPending) {
          Online.startPending = true;
          setStatus("¡Listo! Arrancando...", "success");
          setTimeout(() => {
            Online.startPending = false;
            if (!Online.isConnected || Online.isPlaying) return;
            Online.send(buildStartPayload());
            launchGame();
          }, 700);
        }
        break;
      }
      case "hello_ack": {
        if (msg.mode && msg.mode !== currentMode()) {
          setStatus("El amigo está en otro modo (" + msg.mode + ")", "error");
        }
        // El host avisa su dificultad de boss; el invitado la refleja
        if (!Online.isHost && msg.bossDiff && typeof T.applyBossDiff === "function") {
          T.applyBossDiff(msg.bossDiff, { fromNet: true });
        }
        break;
      }
      case "hello_nack": {
        setStatus(
          "No coincide el modo. Ambos deben elegir " + (msg.want || "el mismo") + ".",
          "error"
        );
        break;
      }
      case "start":
        setStatus("Iniciando partida...", "success");
        // Host manda la dificultad del boss; el invitado solo refleja la etiqueta/IA
        if (msg.bossDiff && typeof T.applyBossDiff === "function") {
          T.applyBossDiff(msg.bossDiff, { fromNet: true });
        }
        if (!Online.isHost) launchGame();
        break;

      case "ping":
        Online.send({ type: "pong", t: msg.t });
        break;

      case "pong": {
        if (typeof msg.t === "number") {
          Online.rttMs = Math.max(0, performance.now() - msg.t);
          Online.lastPongAt = performance.now();
          setLagDisplay();
        }
        break;
      }

      case "sync": {
        if (typeof msg.seq === "number") {
          if (msg.seq <= Online.remoteSeq) break;
          Online.remoteSeq = msg.seq;
        }
        if (T.b) applySeatSnapshot(T.b, msg);
        if (typeof T.onOnlineRemoteSync === "function") T.onOnlineRemoteSync(msg);
        if (msg.dead && T.p && !T.p.dead && typeof T.endOnlineGame === "function") {
          // rival murió → ganas (online 1v1)
          if (T.gameMode === "online") T.endOnlineGame(true, { fromNet: true });
        }
        break;
      }

      case "sync_guest": {
        if (typeof msg.seq === "number") {
          if (msg.seq <= Online.remoteSeq) break;
          Online.remoteSeq = msg.seq;
        }
        if (T.b) applySeatSnapshot(T.b, msg);
        if (typeof T.onOnlineRemoteSync === "function") T.onOnlineRemoteSync(msg);
        checkCoopEnd();
        break;
      }

      case "sync_host": {
        if (typeof msg.seq === "number") {
          if (msg.seq <= Online.remoteSeq) break;
          Online.remoteSeq = msg.seq;
        }
        if (T.b && msg.hostState) applySeatSnapshot(T.b, msg.hostState);
        if (T.boss && msg.bossState) applySeatSnapshot(T.boss, msg.bossState);
        if (typeof T.onOnlineRemoteSync === "function") T.onOnlineRemoteSync(msg);
        checkCoopEnd();
        break;
      }

      case "garbage": {
        if (seenGarbage(msg.id)) break;
        const lines = Number(msg.lines) || 0;
        if (lines <= 0) break;
        if (msg.target === "boss") {
          if (T.boss && !T.boss.dead) {
            T.boss.pendingGarbage += lines;
            if (T.SFX) T.SFX.garbage();
            if (T.updateGarbageMeters) T.updateGarbageMeters();
          }
        } else if (T.p && !T.p.dead) {
          T.p.pendingGarbage += lines;
          if (T.SFX) T.SFX.garbage();
          if (T.updateGarbageMeters) T.updateGarbageMeters();
          if (typeof T.onOnlineGarbage === "function") T.onOnlineGarbage(lines);
        }
        break;
      }

      case "game_over": {
        Online.stopSync();
        // coop: win es el mismo para ambos. 1v1: win ya viene como resultado del receptor.
        if (T.gameMode === "coop" && typeof T.endCoopGame === "function") {
          T.endCoopGame(!!msg.win, { fromNet: true });
        } else if (typeof T.endOnlineGame === "function") {
          T.endOnlineGame(!!msg.win, { fromNet: true });
        }
        break;
      }

      case "revive": {
        // El compañero te revivió (tú estabas KO)
        if (T.gameMode === "coop" && typeof T.applyCoopReviveLocal === "function") {
          T.applyCoopReviveLocal(msg.clearTop);
        }
        break;
      }

      case "revive_ack": {
        // Confirmación visual: el amigo ya no está KO en tu vista
        if (T.b) {
          T.b.dead = false;
          if (msg.grid) T.b.grid = msg.grid;
          if (msg.current) T.b.current = msg.current;
          if (msg.nextType) T.b.nextType = msg.nextType;
        }
        if (typeof T.onCoopPartnerRevived === "function") T.onCoopPartnerRevived();
        break;
      }

      case "rematch": {
        setStatus("Revancha solicitada...", "success");
        if (Online.isHost && !Online.isPlaying) {
          Online.send(buildStartPayload({ rematch: true }));
          launchGame();
        }
        break;
      }

      default:
        break;
    }
  };

  function checkCoopEnd() {
    if (T.gameMode !== "coop") return;
    if (T.state === "over" || T.state === "menu") return;
    if (T.boss && T.boss.dead && typeof T.endCoopGame === "function") {
      T.endCoopGame(true, { fromNet: true });
      return;
    }
    // Solo derrota total si AMBOS jugadores están KO
    if (T.p && T.p.dead && T.b && T.b.dead && typeof T.endCoopGame === "function") {
      T.endCoopGame(false, { fromNet: true });
    }
  }

  function launchGame() {
    if (Online.isPlaying) return;
    if (T.gameMode === "coop" && typeof T.startCoopGame === "function") {
      T.startCoopGame();
    } else if (typeof T.startOnlineGame === "function") {
      T.startOnlineGame();
    }
  }

  Online.sendGarbage = function sendGarbage(lines, target) {
    const n = Number(lines) || 0;
    if (n <= 0) return;
    Online.garbageIdOut += 1;
    Online.send({
      type: "garbage",
      id: Online.myId + "-" + Online.garbageIdOut,
      lines: n,
      target: target || "player",
    });
  };

  /**
   * Fin de partida.
   * - Coop: ambos reciben el MISMO resultado (win compartido).
   * - Online 1v1: el rival recibe el resultado invertido.
   */
  Online.sendGameOver = function sendGameOver(iWon) {
    if (T.gameMode === "coop") {
      Online.send({ type: "game_over", win: !!iWon, coop: true });
    } else {
      Online.send({ type: "game_over", win: !iWon, coop: false });
    }
  };

  Online.sendRevive = function sendRevive(clearTop) {
    Online.send({
      type: "revive",
      clearTop: clearTop == null ? T.REVIVE_CLEAR_TOP : clearTop,
    });
  };

  Online.sendReviveAck = function sendReviveAck(seat) {
    if (!seat) return;
    Online.send({
      type: "revive_ack",
      grid: seat.grid,
      current: seat.current,
      nextType: seat.nextType,
      holdType: seat.holdType,
    });
  };

  Online.requestRematch = function requestRematch() {
    if (!Online.isConnected) {
      setStatus("Sin conexión para revancha", "error");
      return;
    }
    Online.send({ type: "rematch" });
    setStatus("Pidiendo revancha...", "warn");
    if (Online.isHost) {
      Online.send({ type: "start", mode: currentMode(), rematch: true });
      launchGame();
    }
  };

  Online.startSync = function startSync() {
    if (Online.syncIntervalId) clearInterval(Online.syncIntervalId);
    Online.isPlaying = true;
    Online.seqOut = 0;
    Online.remoteSeq = 0;
    Online.startPending = false;
    setStatus("En partida", "success");

    Online.syncIntervalId = setInterval(() => {
      if (!Online.isConnected || !T.p) return;
      Online.seqOut += 1;
      const seq = Online.seqOut;

      if (T.gameMode === "coop") {
        if (!Online.isHost) {
          Online.send(
            Object.assign({ type: "sync_guest", seq: seq }, seatSnapshot(T.p))
          );
        } else {
          Online.send({
            type: "sync_host",
            seq: seq,
            hostState: seatSnapshot(T.p),
            bossState: seatSnapshot(T.boss),
          });
        }
      } else {
        Online.send(Object.assign({ type: "sync", seq: seq }, seatSnapshot(T.p)));
      }
    }, SYNC_MS);
  };

  Online.stopSync = function stopSync() {
    Online.isPlaying = false;
    Online.startPending = false;
    if (Online.syncIntervalId) {
      clearInterval(Online.syncIntervalId);
      Online.syncIntervalId = null;
    }
  };

  function startHeartbeat() {
    stopHeartbeat();
    Online.lastPongAt = performance.now();
    Online.heartbeatId = setInterval(() => {
      if (!Online.conn || !Online.conn.open) return;
      Online.send({ type: "ping", t: performance.now() });
      const now = performance.now();
      const silence = now - (Online.lastRecvAt || Online.lastPongAt || now);
      if (silence > DEAD_MS) {
        setStatus("Rival sin respuesta · enlace caído", "error");
        try {
          Online.conn.close();
        } catch (_) {}
        onLinkLost("Timeout de red");
      } else if (silence > STALE_MS) {
        setStatus("Conexión inestable...", "warn");
      }
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (Online.heartbeatId) {
      clearInterval(Online.heartbeatId);
      Online.heartbeatId = null;
    }
  }

  Online.cleanup = function cleanup(opts) {
    opts = opts || {};
    if (opts.keepWantReconnect === false) Online.wantReconnect = false;
    Online.stopSync();
    Online.isConnected = false;
    Online.isPlaying = false;
    Online.startPending = false;
    stopHeartbeat();
    clearReconnectTimer();
    if (Online.conn) {
      try {
        Online.conn.close();
      } catch (_) {}
      Online.conn = null;
    }
    Online.rttMs = null;
    setLagDisplay();
    updateReconnectUi();
    setStatus("Desconectado", "error");
  };

  Online.shutdown = function shutdown() {
    Online.wantReconnect = false;
    Online.cleanup({ keepWantReconnect: false });
    Online.lastFriendId = "";
    Online.friendId = "";
    if (Online.peer) {
      try {
        Online.peer.destroy();
      } catch (_) {}
      Online.peer = null;
    }
  };

  // ——— UI ———
  function bindUi() {
    const copyBtn = document.getElementById("btn-copy-id");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const text = Online.myId || "";
        if (!text) return;
        const done = () => {
          setStatus("Código copiado: " + text, "success");
          if (T.SFX) T.SFX.ui();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            window.prompt("Copia tu código:", text);
          });
        } else {
          window.prompt("Copia tu código:", text);
        }
      });
    }

    const connectBtn = connectBtnEl();
    if (connectBtn) {
      connectBtn.addEventListener("click", () => {
        if (T.SFX) T.SFX.ui();
        Online.connectToFriend();
      });
    }

    const friendInput = friendInputEl();
    if (friendInput) {
      friendInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          Online.connectToFriend();
        }
      });
    }

    const reBtn = reconnectBtnEl();
    if (reBtn) {
      reBtn.addEventListener("click", () => {
        if (T.SFX) T.SFX.ui();
        Online.wantReconnect = true;
        Online.reconnectAttempts = 0;
        Online.tryReconnect();
      });
    }

    const rematchBtn = document.getElementById("btn-online-rematch");
    if (rematchBtn) {
      rematchBtn.addEventListener("click", () => {
        if (T.SFX) T.SFX.ui();
        Online.requestRematch();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }

  T.Online = Online;
})(window.Tetris);
