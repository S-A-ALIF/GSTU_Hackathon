require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function run() {
  const users = await pool.query('SELECT id, email, role FROM users');
  const teams = await pool.query('SELECT id, name, leader_id, mentor_id FROM teams');
  const members = await pool.query('SELECT * FROM team_members');
  
  console.log('--- USERS ---');
  console.log(users.rows);
  console.log('--- TEAMS ---');
  console.log(teams.rows);
  console.log('--- MEMBERS ---');
  console.log(members.rows);
  process.exit(0);
}

run();
