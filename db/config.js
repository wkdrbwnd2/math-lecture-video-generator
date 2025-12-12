// Node.js equivalent of db/config.php
// Provides a helper to get a MySQL connection pool with the same configuration.

const mysql = require('mysql2/promise');

const DB_HOST = '127.0.0.1';
const DB_PORT = 3311;
const DB_NAME = 'app_36574';
const DB_USER = 'app_36574';
const DB_PASS = '0b02719d-19ed-44a6-b171-2fb47402429f';

let pool;

function db() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

module.exports = {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASS,
  db,
};



