// db/pool.js — PostgreSQL connection pool
// Uses the DATABASE_URL environment variable, automatically provided by
// Railway (or Supabase, if used as the database provider) once a Postgres
// instance is attached to the project.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
