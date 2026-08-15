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
  // get a user from team_members
  const res = await pool.query(`
    SELECT u.id, u.email, u.role, tm.team_id 
    FROM users u 
    JOIN team_members tm ON u.id = tm.user_id 
    LIMIT 1
  `);
  
  if (res.rows.length === 0) {
    console.log('No users in teams.');
    process.exit(0);
  }
  
  const user = res.rows[0];
  console.log('Test User:', user);
  
  const teamService = require('./src/feats/team/team.service').teamService;
  try {
    const teamDetails = await teamService.getMyTeamDetails(user.id);
    console.log('Team Details:', JSON.stringify(teamDetails, null, 2));
  } catch(e) {
    console.error('Error fetching team details:', e);
  }

  process.exit(0);
}

run();
