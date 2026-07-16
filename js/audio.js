/**
 * Audio: SFX + música chiptune (Web Audio API).
 * Lee T.state y T.MUTE_KEY del namespace global.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  let audioCtx = null;
  let audioMuted = localStorage.getItem(T.MUTE_KEY || "tetris-muted") === "1";

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone({ freq = 440, freqEnd = null, type = "square", duration = 0.08, volume = 0.08, delay = 0, attack = 0.005, decay = null }) {
    if (audioMuted) return;
    const ac = ensureAudio();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    const d = decay != null ? decay : duration * 0.85;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, d));
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise({ duration = 0.06, volume = 0.05, delay = 0 }) {
    if (audioMuted) return;
    const ac = ensureAudio();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const len = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  const SFX = {
    isMuted: () => audioMuted,
    setMuted(v) {
      audioMuted = v;
      localStorage.setItem(T.MUTE_KEY, v ? "1" : "0");
      if (v) MUSIC.stop();
      else {
        ensureAudio();
        if (T.state === "playing") MUSIC.start();
      }
    },
    unlock() {
      ensureAudio();
    },
    move() {
      tone({ freq: 180, type: "triangle", duration: 0.04, volume: 0.04 });
    },
    rotate() {
      tone({ freq: 320, freqEnd: 480, type: "square", duration: 0.06, volume: 0.05 });
    },
    lock() {
      tone({ freq: 110, freqEnd: 70, type: "square", duration: 0.08, volume: 0.06 });
      noise({ duration: 0.04, volume: 0.03, delay: 0.01 });
    },
    hardDrop() {
      tone({ freq: 520, freqEnd: 90, type: "sawtooth", duration: 0.12, volume: 0.055 });
      noise({ duration: 0.08, volume: 0.04, delay: 0.02 });
    },
    hold() {
      tone({ freq: 260, type: "triangle", duration: 0.05, volume: 0.05 });
      tone({ freq: 390, type: "triangle", duration: 0.06, volume: 0.04, delay: 0.04 });
    },
    clear(n) {
      const base = 300 + n * 40;
      for (let i = 0; i < n; i++) {
        tone({ freq: base + i * 80, type: "square", duration: 0.1, volume: 0.06, delay: i * 0.05 });
      }
      if (n >= 4) {
        tone({ freq: 200, freqEnd: 600, type: "sawtooth", duration: 0.28, volume: 0.07, delay: 0.05 });
      }
    },
    tspin(kind) {
      const base = kind === "mini" ? 480 : 360;
      [base, base * 1.25, base * 1.5, base * 2].forEach((f, i) => {
        tone({ freq: f, type: "square", duration: 0.1, volume: 0.06, delay: i * 0.055 });
      });
      noise({ duration: 0.08, volume: 0.04, delay: 0.05 });
    },
    garbage() {
      tone({ freq: 90, freqEnd: 50, type: "sawtooth", duration: 0.15, volume: 0.06 });
      noise({ duration: 0.1, volume: 0.04 });
    },
    levelUp() {
      [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, type: "square", duration: 0.1, volume: 0.055, delay: i * 0.07 }));
    },
    gameOver() {
      [392, 349, 311, 262].forEach((f, i) => tone({ freq: f, type: "sawtooth", duration: 0.22, volume: 0.06, delay: i * 0.14 }));
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: "square", duration: 0.12, volume: 0.055, delay: i * 0.09 }));
    },
    pause() {
      tone({ freq: 300, type: "triangle", duration: 0.08, volume: 0.04 });
    },
    unpause() {
      tone({ freq: 400, type: "triangle", duration: 0.08, volume: 0.04 });
    },
    start() {
      [262, 330, 392, 523].forEach((f, i) => tone({ freq: f, type: "square", duration: 0.09, volume: 0.05, delay: i * 0.06 }));
    },
    scoreSave() {
      tone({ freq: 523, type: "triangle", duration: 0.08, volume: 0.05 });
      tone({ freq: 659, type: "triangle", duration: 0.1, volume: 0.05, delay: 0.07 });
      tone({ freq: 784, type: "triangle", duration: 0.14, volume: 0.05, delay: 0.14 });
    },
    ui() {
      tone({ freq: 500, type: "sine", duration: 0.05, volume: 0.035 });
    },
  };

  const MUSIC = (() => {
    const MELODY = [
      76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69, 0, 0,
      74, 77, 81, 79, 77, 76, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69, 0, 0,
      76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69, 0, 0,
      74, 77, 81, 79, 77, 76, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69, 0, 0,
    ];
    const BASS = [
      45, 0, 45, 0, 48, 0, 48, 0, 47, 0, 47, 0, 45, 0, 45, 0,
      50, 0, 50, 0, 48, 0, 48, 0, 47, 0, 47, 0, 45, 0, 45, 0,
      45, 0, 45, 0, 48, 0, 48, 0, 47, 0, 47, 0, 45, 0, 45, 0,
      50, 0, 50, 0, 48, 0, 48, 0, 47, 0, 47, 0, 45, 0, 45, 0,
    ];
    const STEP = 0.14;
    let playing = false;
    let nextNoteTime = 0;
    let step = 0;
    let timerId = null;
    let masterGain = null;

    function midiToFreq(n) {
      return 440 * Math.pow(2, (n - 69) / 12);
    }

    function playNote(ac, midi, when, dur, type, vol) {
      if (!midi) return;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(midiToFreq(midi), when);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.9);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    }

    function playKick(ac, when) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
      g.gain.setValueAtTime(0.08, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(when);
      osc.stop(when + 0.12);
    }

    function playHat(ac, when) {
      const len = Math.floor(ac.sampleRate * 0.03);
      const buffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 6000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.03, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
      src.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      src.start(when);
      src.stop(when + 0.04);
    }

    function scheduler() {
      if (!playing || audioMuted) return;
      const ac = ensureAudio();
      if (!ac || !masterGain) return;
      const horizon = ac.currentTime + 0.2;
      while (nextNoteTime < horizon) {
        const i = step % MELODY.length;
        const when = nextNoteTime;
        playNote(ac, MELODY[i], when, STEP * 0.95, "square", 0.045);
        playNote(ac, BASS[i % BASS.length], when, STEP * 0.9, "triangle", 0.05);
        if (i % 4 === 0) playKick(ac, when);
        if (i % 2 === 1) playHat(ac, when);
        if (i % 8 === 4 && MELODY[i]) {
          playNote(ac, MELODY[i] + 12, when + STEP * 0.5, STEP * 0.4, "square", 0.02);
        }
        nextNoteTime += STEP;
        step++;
      }
      timerId = setTimeout(scheduler, 40);
    }

    return {
      start() {
        if (audioMuted || playing) return;
        const ac = ensureAudio();
        if (!ac) return;
        if (!masterGain) {
          masterGain = ac.createGain();
          masterGain.gain.value = 0.55;
          masterGain.connect(ac.destination);
        }
        playing = true;
        step = 0;
        nextNoteTime = ac.currentTime + 0.05;
        scheduler();
      },
      stop() {
        playing = false;
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      },
      pause() {
        this.stop();
      },
      resume() {
        if (T.state === "playing") this.start();
      },
      isPlaying: () => playing,
    };
  })();

  T.SFX = SFX;
  T.MUSIC = MUSIC;
  T.ensureAudio = ensureAudio;
})(window.Tetris);
