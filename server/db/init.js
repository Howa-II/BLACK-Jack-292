// db/init.js — Runs schema.sql against the connected database.
// Usage: node server/db/init.js

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(schema);
    console.log('Database schema created/verified successfully.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
