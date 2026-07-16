/**
 * Efectos visuales: partículas, banners, shake y flash.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const particles = [];
  const floats = [];
  let bannerTimer = null;

  function burst(px, py, color, count = 14, speed = 2.5) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = speed * (0.4 + Math.random() * 0.9);
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - Math.random() * 1.2,
        life: 0.45 + Math.random() * 0.45,
        max: 0.9,
        size: 2 + Math.random() * 3.5,
        color,
        g: 0.08 + Math.random() * 0.06,
      });
    }
  }

  function lineBurst(rows, block, colors) {
    for (const r of rows) {
      for (let c = 0; c < T.COLS; c++) {
        const color = colors[c % colors.length];
        burst((c + 0.5) * block, (r + 0.5) * block, color, 3, 2.2);
      }
    }
  }

  function hardDropTrail(piece, fromY, block) {
    const matrix = T.Engine.getMatrix(piece);
    const color = T.COLORS[piece.type];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = (piece.x + c + 0.5) * block;
        for (let y = fromY + r; y <= piece.y + r; y += 0.6) {
          if (y < 0) continue;
          particles.push({
            x,
            y: (y + 0.5) * block,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.2,
            life: 0.2 + Math.random() * 0.15,
            max: 0.35,
            size: 2,
            color,
            g: 0,
          });
        }
      }
    }
  }

  function floatText(text, x, y, color) {
    floats.push({ text, x, y, life: 1.1, max: 1.1, color, vy: -0.6 });
  }

  function showBanner(text, kind, target) {
    const el =
      target ||
      (T.gameMode === "versus" ? document.getElementById("vs-fx-banner") : document.getElementById("fx-banner"));
    if (!el) return;
    el.textContent = text;
    el.className = `fx-banner show ${kind || ""}`;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      el.className = "fx-banner";
      el.textContent = "";
    }, 900);
  }

  function shake(wrap) {
    if (!wrap) return;
    wrap.classList.remove("shake");
    void wrap.offsetWidth;
    wrap.classList.add("shake");
    setTimeout(() => wrap.classList.remove("shake"), 360);
  }

  function flash(wrap, kind) {
    if (!wrap) return;
    const cls = kind === "tspin" ? "flash-tspin" : "flash-tetris";
    wrap.classList.add(cls);
    setTimeout(() => wrap.classList.remove(cls), 280);
  }

  function update(dt) {
    const sec = dt / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= sec;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += p.g * (dt / 16);
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= sec;
      f.y += f.vy * (dt / 16);
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    for (const f of floats) {
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    particles.length = 0;
    floats.length = 0;
  }

  T.FX = { burst, lineBurst, hardDropTrail, floatText, showBanner, shake, flash, update, draw, clear };
})(window.Tetris);
