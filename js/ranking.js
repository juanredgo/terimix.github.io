/**
 * Ranking local (localStorage) y helpers de UI.
 */
window.Tetris = window.Tetris || {};

(function (T) {
  "use strict";

  const Ranking = {};

  Ranking.escapeHtml = function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  Ranking.formatDate = function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "2-digit" });
    } catch {
      return "";
    }
  };

  Ranking.load = function load() {
    try {
      const raw = localStorage.getItem(T.STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data
        .filter((e) => e && typeof e.score === "number" && typeof e.name === "string")
        .sort((a, b) => b.score - a.score || b.lines - a.lines)
        .slice(0, T.MAX_RANK);
    } catch {
      return [];
    }
  };

  Ranking.save = function save(list) {
    localStorage.setItem(T.STORAGE_KEY, JSON.stringify(list.slice(0, T.MAX_RANK)));
  };

  Ranking.getHighScore = function getHighScore() {
    const list = Ranking.load();
    return list.length ? list[0].score : 0;
  };

  Ranking.qualifies = function qualifies(points) {
    if (points <= 0) return false;
    const list = Ranking.load();
    if (list.length < T.MAX_RANK) return true;
    return points > list[list.length - 1].score;
  };

  Ranking.addEntry = function addEntry(name, entry) {
    const clean = (name || "Jugador").trim().slice(0, 12) || "Jugador";
    const list = Ranking.load();
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clean,
      score: entry.score,
      lines: entry.lines,
      level: entry.level,
      date: new Date().toISOString(),
    };
    list.push(row);
    list.sort((a, b) => b.score - a.score || b.lines - a.lines);
    const trimmed = list.slice(0, T.MAX_RANK);
    Ranking.save(trimmed);
    localStorage.setItem(T.NAME_KEY, clean);
    return { list: trimmed, entry: row };
  };

  Ranking.clear = function clear() {
    localStorage.removeItem(T.STORAGE_KEY);
  };

  Ranking.renderSide = function renderSide(highlightId = null) {
    const rankingList = document.getElementById("ranking-list");
    const rankingEmpty = document.getElementById("ranking-empty");
    if (!rankingList) return;
    const list = Ranking.load();
    rankingList.innerHTML = "";
    if (!list.length) {
      rankingEmpty?.classList.remove("hidden");
      return;
    }
    rankingEmpty?.classList.add("hidden");
    list.forEach((e, i) => {
      const li = document.createElement("li");
      if (highlightId && e.id === highlightId) li.classList.add("highlight");
      li.innerHTML = `
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-name" title="${Ranking.escapeHtml(e.name)}">${Ranking.escapeHtml(e.name)}</span>
        <span class="rank-score">${e.score}</span>`;
      rankingList.appendChild(li);
    });
  };

  Ranking.renderModal = function renderModal(highlightId = null) {
    const rankingModalList = document.getElementById("ranking-modal-list");
    const rankingModalEmpty = document.getElementById("ranking-modal-empty");
    if (!rankingModalList) return;
    const list = Ranking.load();
    rankingModalList.innerHTML = "";
    if (!list.length) {
      rankingModalEmpty?.classList.remove("hidden");
      return;
    }
    rankingModalEmpty?.classList.add("hidden");
    list.forEach((e, i) => {
      const li = document.createElement("li");
      if (highlightId && e.id === highlightId) li.classList.add("highlight");
      li.innerHTML = `
        <span class="rank-pos">#${i + 1}</span>
        <span class="rank-name">${Ranking.escapeHtml(e.name)}</span>
        <span class="rank-score">${e.score}</span>
        <span class="rank-meta">Líneas ${e.lines} · Nv. ${e.level} · ${Ranking.formatDate(e.date)}</span>`;
      rankingModalList.appendChild(li);
    });
  };

  Ranking.renderOverlayMini = function renderOverlayMini(highlightId = null) {
    const overlayRanking = document.getElementById("overlay-ranking");
    if (!overlayRanking) return;
    const list = Ranking.load().slice(0, 5);
    if (!list.length) {
      overlayRanking.classList.add("hidden");
      overlayRanking.innerHTML = "";
      return;
    }
    const items = list
      .map((e, i) => {
        const hi = highlightId && e.id === highlightId ? ' class="highlight"' : "";
        return `<li${hi}><span class="rank-pos">${i + 1}</span><span class="rank-name">${Ranking.escapeHtml(e.name)}</span><span class="rank-score">${e.score}</span></li>`;
      })
      .join("");
    overlayRanking.innerHTML = `<h3>TOP 5</h3><ol class="ranking-list">${items}</ol>`;
    overlayRanking.classList.remove("hidden");
  };

  T.Ranking = Ranking;
})(window.Tetris);
