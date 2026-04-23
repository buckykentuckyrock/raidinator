const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 👉 IMPORTANT: Railway volume path
const dbPath = '/data/bot.db';
const db = new Database(dbPath);

// Ensure table exists BEFORE inserting
db.prepare(`
  CREATE TABLE IF NOT EXISTS points (
    username TEXT PRIMARY KEY,
    points INTEGER
  )
`).run();

// Load JSON data
const raw = fs.readFileSync('./points.json', 'utf8');
const data = JSON.parse(raw);

console.log("Starting migration into Railway DB...");

// Insert / update data
const stmt = db.prepare(`
  INSERT INTO points (username, points)
  VALUES (?, ?)
  ON CONFLICT(username) DO UPDATE SET points=excluded.points
`);

for (const key in data) {
    const user = data[key];

    stmt.run(
        user.name,
        user.points
    );

    console.log(`Migrated: ${user.name} -> ${user.points}`);
}

console.log("✅ Migration complete");