'use strict';

async function complete(prompt, env = process.env) {
  const baseUrl = (env.OPENROUTER_BASE_URL || '').replace(/\/$/, '');
  if (baseUrl !== 'https://openrouter.ai/api/v1') throw new Error('OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1');
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required');
  if (!env.OPENROUTER_MODEL) throw new Error('OPENROUTER_MODEL is required');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You are a video testimonial campaign analyst. Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || `OpenRouter request failed (${response.status})`);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned an empty response');
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(cleaned); } catch (_) { return { analysis: cleaned }; }
}

module.exports = { complete };
