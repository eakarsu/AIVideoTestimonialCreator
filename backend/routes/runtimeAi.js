'use strict';

const express = require('express');
const { complete } = require('../services/liveAi');

function createRuntimeAiRouter(pool, env = process.env) {
  const router = express.Router();
  router.post('/campaign-optimizer', async (req, res, next) => {
    try {
      const input = req.body || {};
      const result = await complete(
        `Analyze this testimonial campaign and recommend selection, ordering, and distribution. Input: ${JSON.stringify(input).slice(0, 5000)}. Return {summary, findings, recommendations, score, details}.`,
        env,
      );
      const saved = await pool.query(
        `INSERT INTO testimonial_ai_results(tenant_id,user_id,endpoint,input_data,result)
         VALUES($1,$2,'campaign-optimizer',$3,$4) RETURNING id,created_at`,
        [req.auth.tenantId, req.auth.userId, input, result],
      );
      return res.json({ success: true, result, persistence: saved.rows[0] });
    } catch (error) { return next(error); }
  });
  router.get('/history', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id,endpoint,input_data,result,created_at FROM testimonial_ai_results
         WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 50`,
        [req.auth.tenantId, req.auth.userId],
      );
      return res.json({ history: result.rows });
    } catch (error) { return next(error); }
  });
  return router;
}

module.exports = { createRuntimeAiRouter };
