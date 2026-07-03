const path = require('path');
const express = require('express');
const cors = require('cors');
const { db, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'website')));

const now = () => new Date().toISOString();

// --- Helpers -------------------------------------------------------------

async function upsertPlayer(accountHash, displayName) {
  const existingResult = await db.execute({
    sql: 'SELECT * FROM players WHERE account_hash = ?',
    args: [accountHash],
  });
  const existing = existingResult.rows[0];
  const nameLower = displayName.toLowerCase();

  if (!existing) {
    const info = await db.execute({
      sql: 'INSERT INTO players (account_hash, display_name, display_name_lower, updated_at) VALUES (?, ?, ?, ?)',
      args: [accountHash, displayName, nameLower, now()],
    });
    return Number(info.lastInsertRowid);
  }

  if (existing['display_name'] !== displayName) {
    await db.execute({
      sql: 'UPDATE players SET display_name = ?, display_name_lower = ?, updated_at = ? WHERE id = ?',
      args: [displayName, nameLower, now(), existing['id']],
    });
  }

  return existing['id'];
}

// Only overwrite a stored PB if the new time is better (lower), or there
// wasn't one before. Boss kill times only ever "improve" in this dataset.
async function upsertPb(playerId, boss, timeSeconds) {
  const existingResult = await db.execute({
    sql: 'SELECT * FROM personal_bests WHERE player_id = ? AND boss = ?',
    args: [playerId, boss],
  });
  const existing = existingResult.rows[0];

  if (!existing) {
    await db.execute({
      sql: 'INSERT INTO personal_bests (player_id, boss, time_seconds, updated_at) VALUES (?, ?, ?, ?)',
      args: [playerId, boss, timeSeconds, now()],
    });
    return true;
  }

  if (timeSeconds < existing['time_seconds']) {
    await db.execute({
      sql: 'UPDATE personal_bests SET time_seconds = ?, updated_at = ? WHERE id = ?',
      args: [timeSeconds, now(), existing['id']],
    });
    return true;
  }

  return false;
}

// --- Routes ----------------------------------------------------------------

app.post('/api/sync', async (req, res) => {
  const { accountHash, displayName, pbs } = req.body || {};

  if (!accountHash || typeof accountHash !== 'string') {
    return res.status(400).json({ error: 'accountHash is required' });
  }
  if (!displayName || typeof displayName !== 'string') {
    return res.status(400).json({ error: 'displayName is required' });
  }
  if (!pbs || typeof pbs !== 'object' || Array.isArray(pbs)) {
    return res.status(400).json({ error: 'pbs must be an object of { bossName: seconds }' });
  }

  try {
    const playerId = await upsertPlayer(accountHash, displayName);

    let updated = 0;
    for (const [rawBoss, seconds] of Object.entries(pbs)) {
      const boss = rawBoss.trim().toLowerCase();
      const timeSeconds = Number(seconds);
      if (!boss || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
        continue;
      }
      if (await upsertPb(playerId, boss, timeSeconds)) {
        updated += 1;
      }
    }

    res.json({ ok: true, playerId, received: Object.keys(pbs).length, updated });
  } catch (err) {
    console.error('sync failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/players/:name', async (req, res) => {
  try {
    const playerResult = await db.execute({
      sql: 'SELECT * FROM players WHERE display_name_lower = ?',
      args: [req.params.name.toLowerCase()],
    });
    const player = playerResult.rows[0];

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const pbsResult = await db.execute({
      sql: 'SELECT boss, time_seconds, updated_at FROM personal_bests WHERE player_id = ? ORDER BY boss COLLATE NOCASE',
      args: [player['id']],
    });

    const pbs = pbsResult.rows.map((row) => ({
      boss: row['boss'],
      timeSeconds: row['time_seconds'],
      updatedAt: row['updated_at'],
    }));

    res.json({
      displayName: player['display_name'],
      updatedAt: player['updated_at'],
      pbs,
    });
  } catch (err) {
    console.error('player lookup failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase().trim();
  if (!q) {
    return res.json([]);
  }
  try {
    const result = await db.execute({
      sql: 'SELECT display_name FROM players WHERE display_name_lower LIKE ? ORDER BY display_name COLLATE NOCASE LIMIT 10',
      args: [`%${q}%`],
    });
    res.json(result.rows.map((r) => r['display_name']));
  } catch (err) {
    console.error('search failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/leaderboard/:boss', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  try {
    const result = await db.execute({
      sql: `
        SELECT p.display_name AS displayName, pb.time_seconds AS timeSeconds, pb.updated_at AS updatedAt
        FROM personal_bests pb
        JOIN players p ON p.id = pb.player_id
        WHERE pb.boss = ? COLLATE NOCASE
        ORDER BY pb.time_seconds ASC
        LIMIT ?
      `,
      args: [req.params.boss, limit],
    });
    res.json(result.rows.map((r) => ({
      displayName: r['displayName'],
      timeSeconds: r['timeSeconds'],
      updatedAt: r['updatedAt'],
    })));
  } catch (err) {
    console.error('leaderboard lookup failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/bosses', async (req, res) => {
  try {
    const result = await db.execute('SELECT DISTINCT boss FROM personal_bests ORDER BY boss COLLATE NOCASE');
    res.json(result.rows.map((r) => r['boss']));
  } catch (err) {
    console.error('boss list failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// --- Startup -----------------------------------------------------------

async function start() {
  await init();
  app.listen(PORT, () => {
    console.log(`PB tracker backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
