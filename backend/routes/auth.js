'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const { authentication } = require('../middleware/auth');

function createAuthRouter(pool, env = process.env) {
  const router = express.Router();
  const issueToken = (requireTenant) => async (req, res, next) => {
    try {
      const { email, password, tenantId } = req.body || {};
      if (!email || !password || (requireTenant && !tenantId)) {
        return res.status(400).json({ error: requireTenant ? 'email_password_tenant_required' : 'email_password_required' });
      }
      if (tenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
        return res.status(400).json({ error: 'tenant_id_must_be_uuid' });
      }
      const result = await pool.query(
        `SELECT u.id, u.email, u.password_hash, m.role, m.tenant_id
         FROM testimonial_users u JOIN testimonial_memberships m ON m.user_id = u.id
         WHERE lower(u.email) = lower($1) AND ($2::uuid IS NULL OR m.tenant_id = $2::uuid)
           AND u.status = 'active' AND m.status = 'active'`,
        [email, tenantId || null],
      );
      if (result.rowCount !== 1 || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const user = result.rows[0];
      const token = jwt.sign(
        { tenant_id: user.tenant_id, role: user.role }, env.JWT_SECRET,
        { subject: user.id, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithm: 'HS256', expiresIn: '1h' },
      );
      return res.json({
        token,
        expiresInSeconds: 3600,
        tenantId: user.tenant_id,
        role: user.role,
        user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
      });
    } catch (error) { return next(error); }
  };
  router.post('/token', issueToken(true));
  router.post('/login', issueToken(false));
  router.get('/me', authentication(pool, env), async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT id, email, status FROM testimonial_users WHERE id = $1',
        [req.auth.userId],
      );
      if (result.rowCount !== 1) return res.status(404).json({ error: 'user_not_found' });
      return res.json({ ...result.rows[0], role: req.auth.role, tenantId: req.auth.tenantId });
    } catch (error) { return next(error); }
  });
  return router;
}

module.exports = { createAuthRouter };
