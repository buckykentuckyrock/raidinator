const Database = require('better-sqlite3');

// IMPORTANT: use Railway volume path
const db = new Database('/data/bot.db');

// Responses table
db.prepare(`
  CREATE TABLE IF NOT EXISTS responses (
    userId TEXT PRIMARY KEY,
    choice TEXT
  )
`).run();

// Points table
db.prepare(`
  CREATE TABLE IF NOT EXISTS points (
    username TEXT PRIMARY KEY,
    points INTEGER
  )
`).run();

module.exports = db;