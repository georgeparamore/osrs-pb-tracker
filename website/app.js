const resultsEl = document.getElementById('results');
const bossSelect = document.getElementById('boss-select');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const suggestionsEl = document.getElementById('search-suggestions');

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const hasFraction = Math.abs(s - Math.round(s)) > 0.001;
  const secStr = hasFraction
    ? s.toFixed(2).padStart(5, '0')
    : String(Math.round(s)).padStart(2, '0');

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${secStr}`;
  }
  return `${m}:${secStr}`;
}

function titleCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

// Raids report multiple records under a shared base name (e.g. "Theatre of
// Blood", "Theatre of Blood 3 players", "Theatre of Blood - Fastest Room").
// The bare base entry is ambiguous (it can silently mean either "best across
// any team size" or ends up holding an unrelated single-room time), so once
// a more specific variant exists we hide the bare one rather than show a
// number that might be misleading.
function hideAmbiguousBaseEntries(items, getName) {
  const names = items.map((item) => getName(item).toLowerCase());
  return items.filter((item) => {
    const lower = getName(item).toLowerCase();
    const hasMoreSpecificVariant = names.some((n) => n !== lower && n.startsWith(lower + ' '));
    return !hasMoreSpecificVariant;
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function setUrl(params) {
  const url = new URL(window.location.href);
  url.search = '';
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  window.history.pushState({}, '', url);
}

async function loadBossList() {
  try {
    const res = await fetch('/api/bosses');
    const allBosses = await res.json();
    const bosses = hideAmbiguousBaseEntries(allBosses, (boss) => boss);

    bossSelect.innerHTML = '<option value="">Select a boss...</option>';
    bosses.forEach((boss) => {
      const opt = document.createElement('option');
      opt.value = boss;
      opt.textContent = titleCase(boss);
      bossSelect.appendChild(opt);
    });

    if (bosses.length === 0) {
      bossSelect.innerHTML = '<option value="">No PB data synced yet</option>';
    }
  } catch (err) {
    bossSelect.innerHTML = '<option value="">Could not load bosses</option>';
  }
}

async function showPlayer(name) {
  resultsEl.innerHTML = '<div class="empty-state">Loading...</div>';

  try {
    const res = await fetch(`/api/players/${encodeURIComponent(name)}`);
    if (res.status === 404) {
      resultsEl.innerHTML = `<div class="empty-state">No PB data found for <strong>${escapeHtml(name)}</strong> yet. They need to sync with the PB Tracker plugin first.</div>`;
      return;
    }
    const data = await res.json();

    if (!data.pbs.length) {
      resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(data.displayName)} has synced, but has no recorded PBs yet.</div>`;
      return;
    }

    const visiblePbs = hideAmbiguousBaseEntries(data.pbs, (pb) => pb.boss);

    const rows = visiblePbs
      .map(
        (pb) => `
        <tr>
          <td>${escapeHtml(titleCase(pb.boss))}</td>
          <td>${formatTime(pb.timeSeconds)}</td>
          <td>${formatDate(pb.updatedAt)}</td>
        </tr>`
      )
      .join('');

    resultsEl.innerHTML = `
      <h2 class="result-title">${escapeHtml(data.displayName)}</h2>
      <div class="result-meta">Last synced ${formatDate(data.updatedAt)} &middot; ${visiblePbs.length} PB(s) recorded</div>
      <table>
        <thead><tr><th>Boss</th><th>Personal Best</th><th>Recorded</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    resultsEl.innerHTML = '<div class="error-state">Could not reach the server. Is the backend running?</div>';
  }
}

async function showLeaderboard(boss) {
  resultsEl.innerHTML = '<div class="empty-state">Loading...</div>';
  bossSelect.value = boss;

  try {
    const res = await fetch(`/api/leaderboard/${encodeURIComponent(boss)}?limit=25`);
    const rows = await res.json();

    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-state">No synced PBs for <strong>${escapeHtml(boss)}</strong> yet.</div>`;
      return;
    }

    const body = rows
      .map(
        (r, i) => `
        <tr>
          <td class="rank">${i + 1}</td>
          <td>${escapeHtml(r.displayName)}</td>
          <td>${formatTime(r.timeSeconds)}</td>
        </tr>`
      )
      .join('');

    resultsEl.innerHTML = `
      <h2 class="result-title">${escapeHtml(titleCase(boss))} &mdash; Top times</h2>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Personal Best</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;
  } catch (err) {
    resultsEl.innerHTML = '<div class="error-state">Could not reach the server. Is the backend running?</div>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = searchInput.value.trim();
  if (!name) return;
  setUrl({ player: name });
  showPlayer(name);
});

let suggestTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = searchInput.value.trim();
  if (!q) {
    suggestionsEl.innerHTML = '';
    return;
  }
  suggestTimer = setTimeout(async () => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const names = await res.json();
    suggestionsEl.innerHTML = names
      .map((n) => `<button type="button" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`)
      .join('');
  }, 200);
});

suggestionsEl.addEventListener('click', (e) => {
  const name = e.target.getAttribute('data-name');
  if (!name) return;
  searchInput.value = name;
  suggestionsEl.innerHTML = '';
  setUrl({ player: name });
  showPlayer(name);
});

bossSelect.addEventListener('change', () => {
  if (bossSelect.value) {
    setUrl({ boss: bossSelect.value });
    showLeaderboard(bossSelect.value);
  }
});

// --- Initial load ---------------------------------------------------------

(function init() {
  loadBossList();

  const params = new URLSearchParams(window.location.search);
  const player = params.get('player');
  const boss = params.get('boss');

  if (player) {
    searchInput.value = player;
    showPlayer(player);
  } else if (boss) {
    showLeaderboard(boss);
  } else {
    resultsEl.innerHTML = '<div class="empty-state">Search a player above, or pick a boss to see the leaderboard.</div>';
  }
})();
