import React, { useState } from 'react';

export default function ConsentRightsCheck() {
  const [form, setForm] = useState({ consentSigned: false, usageChannels: 'website,linkedin,paid ads', expiresInDays: 20, minorFeatured: false, musicLicensed: false });
  const [result, setResult] = useState(null);
  const submit = async () => {
    const response = await fetch('/api/consent-rights-check/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ ...form, usageChannels: form.usageChannels.split(',').map((item) => item.trim()).filter(Boolean) }),
    });
    setResult(await response.json());
  };
  return (
    <div className="page">
      <h1>Consent Rights Check</h1>
      <div className="card">
        <label>Usage channels<input value={form.usageChannels} onChange={(e) => setForm({ ...form, usageChannels: e.target.value })} /></label>
        <label>Expires in days<input type="number" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={form.consentSigned} onChange={(e) => setForm({ ...form, consentSigned: e.target.checked })} /> Consent signed</label>
        <label><input type="checkbox" checked={form.minorFeatured} onChange={(e) => setForm({ ...form, minorFeatured: e.target.checked })} /> Minor featured</label>
        <label><input type="checkbox" checked={form.musicLicensed} onChange={(e) => setForm({ ...form, musicLicensed: e.target.checked })} /> Music licensed</label>
        <button className="btn btn-primary" onClick={submit}>Check rights</button>
      </div>
      {result && <div className="card"><h2>{result.level.toUpperCase()} · {result.score}/100</h2><ul>{result.actions.map((action) => <li key={action}>{action}</li>)}</ul></div>}
    </div>
  );
}
