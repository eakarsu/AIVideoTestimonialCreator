'use strict';

const jwt = require('jsonwebtoken');

function assertAuthConfiguration(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  if (!env.JWT_ISSUER) throw new Error('JWT_ISSUER is required');
  if (!env.JWT_AUDIENCE) throw new Error('JWT_AUDIENCE is required');
}

function authentication(pool, env = process.env) {
  assertAuthConfiguration(env);
  return async (req, res, next) => {
    try {
      const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
      if (!match) return res.status(401).json({ error: 'bearer_token_required' });
      const claims = jwt.verify(match[1], env.JWT_SECRET, {
        issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithms: ['HS256'],
      });
      if (!claims.sub || !claims.tenant_id) return res.status(403).json({ error: 'tenant_claim_required' });
      const membership = await pool.query(
        `SELECT m.role FROM testimonial_memberships m
         JOIN testimonial_users u ON u.id = m.user_id
         WHERE m.tenant_id = $1 AND m.user_id = $2 AND m.status = 'active' AND u.status = 'active'`,
        [claims.tenant_id, claims.sub],
      );
      if (membership.rowCount !== 1) return res.status(403).json({ error: 'active_membership_required' });
      req.auth = { userId: claims.sub, tenantId: claims.tenant_id, role: membership.rows[0].role };
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'invalid_token' });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.auth?.role)
    ? next()
    : res.status(403).json({ error: 'insufficient_role' });
}

module.exports = { assertAuthConfiguration, authentication, requireRole };
