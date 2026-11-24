const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load backend/.env when this module is used outside server.js (for example by db:test).
const envFile = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL belum tersedia. Pastikan backend/.env dimuat sebelum database.js.');
}

const pool = new Pool({ connectionString });

module.exports = pool;
