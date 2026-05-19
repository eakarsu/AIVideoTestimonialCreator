// // === Batch 08 Gaps & Frontend Mounts ===
// Feature: No native LinkedIn/TikTok publishing
// Kind: gap_non_ai  Project: AIVideoTestimonialCreator
const express = require('express');
const router = express.Router();
let pool = null;
try { pool = require('../config/database'); } catch (_) { try { pool = require('../db'); } catch (_) { try { pool = require('../db.js'); } catch (_) {} } }

let _gapTableInit = false;
async function ensureGapTable() {
  if (_gapTableInit || !pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS gap_features (
      id SERIAL PRIMARY KEY,
      feature_slug TEXT NOT NULL,
      project TEXT,
      input JSONB,
      output JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    _gapTableInit = true;
  } catch (_) { /* lazy: ignore errors */ }
}

async function callOpenRouter(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  if (!apiKey) {
    return { ai_disabled: true, note: 'OPENROUTER_API_KEY missing. Returning stub output.', echo: userPrompt.slice(0, 240) };
  }
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.6,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`OpenRouter ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  let raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  raw = raw.trim().replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  try { return JSON.parse(raw); } catch { return { raw }; }
}

router.post('/run', async (req, res) => {
  const input = req.body || {};
  try {
    ensureGapTable();
    const sys = 'You are an assistant for the "No native LinkedIn/TikTok publishing" feature in project AIVideoTestimonialCreator. Respond as strict JSON.';
    const user = `Feature request: No native LinkedIn/TikTok publishing\n\nUser input JSON:\n` + JSON.stringify(input).slice(0, 4000) + '\n\nReturn JSON with summary, findings array, recommendations array.';
    const out = await callOpenRouter(sys, user);
    if (pool) {
      try { await pool.query('INSERT INTO gap_features(feature_slug, project, input, output) VALUES ($1,$2,$3,$4)', ['gap-no-native-linkedin-tiktok-publishing', 'AIVideoTestimonialCreator', JSON.stringify(input), JSON.stringify(out)]); } catch (_) {}
    }
    res.json({ success: true, feature: 'gap-no-native-linkedin-tiktok-publishing', kind: 'gap_non_ai', result: out });
  } catch (err) {
    res.status(500).json({ error: err.message || 'gap feature failed' });
  }
});

router.get('/history', async (req, res) => {
  if (!pool) return res.json({ history: [] });
  try {
    ensureGapTable();
    const { rows } = await pool.query('SELECT id, input, output, created_at FROM gap_features WHERE feature_slug = $1 ORDER BY created_at DESC LIMIT 50', ['gap-no-native-linkedin-tiktok-publishing']);
    res.json({ history: rows });
  } catch (_) { res.json({ history: [] }); }
});

module.exports = router;
