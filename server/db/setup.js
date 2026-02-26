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
    const hash1 = await bcrypt.hash('password1', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, phone_number = EXCLUDED.phone_number`,
      ['Agent One', 'agent1', hash1, '+18888538185']
    );
    console.log('Agent One created: agent1 / password1 → +18888538185');

    // Create Agent Two
    const hash2 = await bcrypt.hash('password2', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, phone_number = EXCLUDED.phone_number`,
      ['Agent Two', 'agent2', hash2, '+18333002882']
    );
    console.log('Agent Two created: agent2 / password2 → +18333002882');

    // Deactivate old agents from previous setup
    await db.query(
      `UPDATE kc_agents SET is_active = false WHERE email NOT IN ('agent1', 'agent2')`
    );

    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
