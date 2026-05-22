import React, { useState } from 'react';

const API_URL = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001/api';

export default function EditBriefPdf() {
  const [title, setTitle] = useState('Q2 Customer Testimonial – ACME SaaS');
  const [notes, setNotes] = useState('Tighten cold open, keep transformation moment at 0:18, end on quantified outcome.');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchPdf = async () => {
    setLoading(true); setErr(null);
    try {
      const token = localStorage.getItem('token') || '';
      const url = `${API_URL}/custom-views/edit-brief.pdf?title=${encodeURIComponent(title)}&notes=${encodeURIComponent(notes)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      setPreviewUrl(obj);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl; a.download = 'edit-brief.pdf'; a.click();
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Edit Brief PDF</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
        Generate a printable, server-rendered PDF brief for the video editor.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
          Notes for editor
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={fetchPdf} disabled={loading}>
            {loading ? 'Generating…' : 'Generate PDF'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={download} disabled={!previewUrl}>
            Download
          </button>
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: 12 }}>Error: {err}</div>}
        {previewUrl && (
          <iframe title="edit-brief" src={previewUrl} style={{ width: '100%', height: 420, border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 6 }} />
        )}
      </div>
    </div>
  );
}
