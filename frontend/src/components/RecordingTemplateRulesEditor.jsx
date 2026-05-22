import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001/api';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return { Authorization: `Bearer ${token}` };
}

const emptyRule = () => ({
  name: '',
  scope: 'capture',
  script: '',
  prompt: '',
  priority: 'medium',
  active: true,
});

export default function RecordingTemplateRulesEditor() {
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(emptyRule());
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await axios.get(`${API_URL}/custom-views/recording-rules`, { headers: authHeaders() });
      setRules(r.data.rules || []);
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(null);
    try {
      if (editingId) {
        await axios.put(`${API_URL}/custom-views/recording-rules/${editingId}`, draft, { headers: authHeaders() });
      } else {
        await axios.post(`${API_URL}/custom-views/recording-rules`, draft, { headers: authHeaders() });
      }
      setDraft(emptyRule()); setEditingId(null);
      load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  const startEdit = (r) => { setEditingId(r.id); setDraft({ ...r }); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyRule()); };

  const remove = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await axios.delete(`${API_URL}/custom-views/recording-rules/${id}`, { headers: authHeaders() });
      load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Recording Template Rules Editor</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
        CRUD over recording scripts + AI prompts that guide testimonial capture.
      </p>

      <div style={{ display: 'grid', gap: 8, padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
          <input placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
          <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
            <option value="capture">capture</option>
            <option value="review">review</option>
            <option value="publish">publish</option>
          </select>
          <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <textarea placeholder="Script (shown to speaker)" value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} rows={2}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        <textarea placeholder="AI prompt (used during analysis)" value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={2}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={!!draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          Active
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!draft.name || !draft.script}>
            {editingId ? 'Update rule' : 'Add rule'}
          </button>
          {editingId && <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Error: {err}</div>}
      {loading ? <div>Loading…</div> : (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th><th>Scope</th><th>Priority</th><th>Active</th><th>Script</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.scope}</td>
                <td>{r.priority}</td>
                <td>{r.active ? 'yes' : 'no'}</td>
                <td style={{ maxWidth: 280, fontSize: 12, color: '#475569' }}>{r.script}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
