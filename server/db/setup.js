require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const db = require('./index');
const bcrypt = require('bcryptjs');

async function setup() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(schema);
    console.log('Tables created successfully.');

    // Create a default agent
    const hash = await bcrypt.hash('agent123', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ['Agent One', 'agent@krispcall.com', hash]
    );
    console.log('Default agent created: agent@krispcall.com / agent123');

    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
