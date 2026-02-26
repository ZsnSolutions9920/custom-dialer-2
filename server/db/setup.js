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

    // Create Agent One
    const hash1 = await bcrypt.hash('agent123', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET phone_number = EXCLUDED.phone_number`,
      ['Agent One', 'agent@krispcall.com', hash1, '+18888538185']
    );
    console.log('Agent One created: agent@krispcall.com / agent123 → +18888538185');

    // Create Agent Two
    const hash2 = await bcrypt.hash('agent234', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET phone_number = EXCLUDED.phone_number`,
      ['Agent Two', 'agent2@krispcall.com', hash2, '+18333002882']
    );
    console.log('Agent Two created: agent2@krispcall.com / agent234 → +18333002882');

    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
