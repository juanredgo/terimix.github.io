/**
 * Módulo de Red P2P (PeerJS) para juego multijugador online.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Online = {
    peer: null,
    conn: null,
    myId: "",
    friendId: "",
    isHost: false,
    isConnected: false,
    isPlaying: false,
    syncIntervalId: null,
  };

  const statusEl = document.getElementById("online-status");
  const myPeerIdEl = document.getElementById("my-peer-id");
  const friendInputEl = document.getElementById("friend-peer-id");
  const connectBtnEl = document.getElementById("btn-connect-online");

  function setStatus(text, type) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "online-status";
    if (type) statusEl.classList.add(type);
  }

  // Genera un código de sala de 6 dígitos
  function generateRoomId() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  Online.init = function () {
    if (Online.peer) return;

    Online.myId = generateRoomId();
    myPeerIdEl.textContent = Online.myId;
    setStatus("Conectando a PeerServer...", "success");

    // Intentamos conectar con el ID generado a los servidores públicos de PeerJS
    Online.peer = new Peer(Online.myId, {
      debug: 1,
    });

    Online.peer.on("open", (id) => {
      Online.myId = id;
      myPeerIdEl.textContent = id;
      setStatus("Esperando oponente o ingresa código de amigo...", "success");
    });

    Online.peer.on("error", (err) => {
      console.error("PeerJS Error:", err);
      if (err.type === "unavailable-id") {
        // Si el ID generado está ocupado, intentamos con otro
        Online.peer.destroy();
        Online.peer = null;
        setTimeout(Online.init, 500);
      } else {
        setStatus("Error de conexión P2P", "error");
      }
    });

    // Escuchar conexiones entrantes (Host)
    Online.peer.on("connection", (c) => {
      if (Online.conn) {
        c.close();
        return;
      }
      Online.isHost = true;
      Online.setupConnection(c);
    });
  };

  Online.setupConnection = function (c) {
    Online.conn = c;
    Online.friendId = c.peer;
    friendInputEl.value = c.peer;

    c.on("open", () => {
      Online.isConnected = true;
      setStatus("¡Conectado! Iniciando...", "success");
      T.SFX.scoreSave();

      if (Online.isHost) {
        // El Host envía señal de inicio y el juego arranca
        setTimeout(() => {
          Online.send({ type: "start" });
          if (T.gameMode === "coop") T.startCoopGame();
          else T.startOnlineGame();
        }, 1000);
      }
    });

    c.on("data", (data) => {
      Online.handleMessage(data);
    });

    c.on("close", () => {
      Online.cleanup();
      setStatus("Conexión perdida", "error");
    });

    c.on("error", (err) => {
      console.error("Connection error:", err);
      Online.cleanup();
      setStatus("Error de conexión", "error");
    });
  };

  // Invitado: conectar a la sala del Host
  Online.connectToFriend = function () {
    const targetId = friendInputEl.value.trim();
    if (!targetId || targetId.length !== 6 || isNaN(targetId)) {
      setStatus("Código inválido (deben ser 6 dígitos)", "error");
      return;
    }

    if (!Online.peer || !Online.peer.open) {
      setStatus("Peer no inicializado. Reintentando...", "error");
      Online.init();
      return;
    }

    setStatus(`Conectando a sala ${targetId}...`, "success");
    Online.isHost = false;
    const c = Online.peer.connect(targetId, {
      reliable: true,
    });
    Online.setupConnection(c);
  };

  Online.send = function (data) {
    if (Online.conn && Online.conn.open) {
      Online.conn.send(data);
    }
  };

  Online.handleMessage = function (msg) {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "start":
        setStatus("Iniciando juego...", "success");
        if (T.gameMode === "coop") T.startCoopGame();
        else T.startOnlineGame();
        break;

      case "sync":
        if (T.b) {
          T.b.grid = msg.grid;
          T.b.current = msg.current;
          T.b.holdType = msg.holdType;
          T.b.nextType = msg.nextType;
          T.b.lines = msg.lines;
          T.b.sent = msg.sent;
          T.b.dead = msg.dead;
          if (msg.dead) {
            T.endOnlineGame(true);
          }
        }
        break;

      case "sync_guest":
        if (T.b) {
          T.b.grid = msg.grid;
          T.b.current = msg.current;
          T.b.holdType = msg.holdType;
          T.b.nextType = msg.nextType;
          T.b.lines = msg.lines;
          T.b.sent = msg.sent;
          T.b.dead = msg.dead;
          
          if (T.p && T.p.dead && T.b.dead) {
            T.endCoopGame(false);
          }
          if (T.boss && T.boss.dead) {
            T.endCoopGame(true);
          }
        }
        break;

      case "sync_host":
        if (T.b && msg.hostState) {
          T.b.grid = msg.hostState.grid;
          T.b.current = msg.hostState.current;
          T.b.holdType = msg.hostState.holdType;
          T.b.nextType = msg.hostState.nextType;
          T.b.lines = msg.hostState.lines;
          T.b.sent = msg.hostState.sent;
          T.b.dead = msg.hostState.dead;
        }
        if (T.boss && msg.bossState) {
          T.boss.grid = msg.bossState.grid;
          T.boss.current = msg.bossState.current;
          T.boss.nextType = msg.bossState.nextType;
          T.boss.lines = msg.bossState.lines;
          T.boss.sent = msg.bossState.sent;
          T.boss.dead = msg.bossState.dead;
        }
        if (T.p && T.p.dead && T.b && T.b.dead) {
          T.endCoopGame(false);
        }
        if (T.boss && T.boss.dead) {
          T.endCoopGame(true);
        }
        break;

      case "garbage":
        if (T.p && !T.p.dead) {
          T.p.pendingGarbage += msg.lines;
          T.SFX.garbage();
          T.updateGarbageMeters();
        }
        break;

      case "garbage_to_boss":
        if (T.boss && !T.boss.dead) {
          T.boss.pendingGarbage += msg.lines;
          T.SFX.garbage();
          T.updateGarbageMeters();
        }
        break;
    }
  };

  Online.startSync = function () {
    if (Online.syncIntervalId) clearInterval(Online.syncIntervalId);
    Online.isPlaying = true;
    Online.syncIntervalId = setInterval(() => {
      if (!T.p) return;

      if (T.gameMode === "coop") {
        if (!Online.isHost) {
          Online.send({
            type: "sync_guest",
            grid: T.p.grid,
            current: T.p.current,
            holdType: T.p.holdType,
            nextType: T.p.nextType,
            lines: T.p.lines,
            sent: T.p.sent,
            dead: T.p.dead,
          });
        } else {
          Online.send({
            type: "sync_host",
            hostState: {
              grid: T.p.grid,
              current: T.p.current,
              holdType: T.p.holdType,
              nextType: T.p.nextType,
              lines: T.p.lines,
              sent: T.p.sent,
              dead: T.p.dead,
            },
            bossState: T.boss ? {
              grid: T.boss.grid,
              current: T.boss.current,
              nextType: T.boss.nextType,
              lines: T.boss.lines,
              sent: T.boss.sent,
              dead: T.boss.dead,
            } : null
          });
        }
      } else {
        Online.send({
          type: "sync",
          grid: T.p.grid,
          current: T.p.current,
          holdType: T.p.holdType,
          nextType: T.p.nextType,
          lines: T.p.lines,
          sent: T.p.sent,
          dead: T.p.dead,
        });
      }
    }, 50);
  };

  Online.stopSync = function () {
    Online.isPlaying = false;
    if (Online.syncIntervalId) {
      clearInterval(Online.syncIntervalId);
      Online.syncIntervalId = null;
    }
  };

  Online.cleanup = function () {
    Online.stopSync();
    Online.isConnected = false;
    Online.isPlaying = false;
    if (Online.conn) {
      Online.conn.close();
      Online.conn = null;
    }
    setStatus("Desconectado", "error");
  };

  Online.shutdown = function () {
    Online.cleanup();
    if (Online.peer) {
      Online.peer.destroy();
      Online.peer = null;
    }
  };

  // Event Listeners para la UI online
  document.getElementById("btn-copy-id").addEventListener("click", () => {
    navigator.clipboard.writeText(Online.myId)
      .then(() => {
        setStatus("Código de sala copiado", "success");
        T.SFX.ui();
      })
      .catch((err) => {
        console.error("Could not copy room id:", err);
      });
  });

  connectBtnEl.addEventListener("click", () => {
    T.SFX.ui();
    Online.connectToFriend();
  });

  T.Online = Online;
})(window.Tetris);
