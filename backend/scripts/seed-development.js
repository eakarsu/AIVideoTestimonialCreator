'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createPool } = require('../db');

function stableUuid(value) {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

async function main(env = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('development identity seeding is disabled in production');
  const email = env.SEED_ADMIN_EMAIL || env.ADMIN_EMAIL || env.DEMO_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.DEMO_PASSWORD;
  const tenantSeed = env.TESTIMONIAL_DEVELOPMENT_TENANT_ID || env.SEED_TENANT_ID || env.GOVERNANCE_TENANT_ID;
  if (!email || !password || password.length < 12 || !tenantSeed) {
    throw new Error('development seed requires an admin email, a 12+ character password, and a tenant identifier');
  }

  const pool = createPool(env);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenantId = stableUuid(tenantSeed);
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO testimonial_tenants (id, name, status) VALUES ($1, $2, 'active')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'`,
      [tenantId, env.BOOTSTRAP_TENANT_NAME || 'Development Tenant'],
    );
    const user = await client.query(
      `INSERT INTO testimonial_users (email, password_hash, status) VALUES ($1, $2, 'active')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'
       RETURNING id`,
      [email.toLowerCase(), passwordHash],
    );
    await client.query(
      `INSERT INTO testimonial_memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner', status = 'active'`,
      [tenantId, user.rows[0].id],
    );
    await client.query('COMMIT');
    console.log(`Provisioned development identity ${email.toLowerCase()} for tenant ${tenantId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { main, stableUuid };
