import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001/api';

export default function CollectionChart() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    axios.get(`${API_URL}/custom-views/collection-chart`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card" style={{ padding: 24 }}>Loading collection chart…</div>;
  if (err) return <div className="card" style={{ padding: 24, color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return null;

  const max = Math.max(1, ...data.buckets.map((b) => b.collected));
  const statusMax = Math.max(1, ...data.status_breakdown.map((s) => s.count));

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Testimonial Collection Chart</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
        Last 14 days · total collected: <strong>{data.total}</strong>
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
        {data.buckets.map((b) => (
          <div key={b.date} title={`${b.date}: ${b.collected}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${(b.collected / max) * 140}px`,
              background: 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)',
              borderRadius: '6px 6px 0 0',
            }} />
            <div style={{ fontSize: 9, color: '#94a3b8' }}>{b.date.slice(5)}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#475569' }}>Status breakdown</h4>
        {data.status_breakdown.map((s) => (
          <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 90, fontSize: 12, color: '#475569', textTransform: 'capitalize' }}>{s.status}</div>
            <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(s.count / statusMax) * 100}%`, height: '100%', background: '#10b981' }} />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{s.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
