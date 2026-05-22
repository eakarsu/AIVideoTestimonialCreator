import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001/api';

function colorFor(intensity) {
  // 0 -> light, 100 -> deep teal
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  const r = Math.round(236 - 220 * t);
  const g = Math.round(254 - 100 * t);
  const b = Math.round(255 - 90 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function CategoryHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    axios.get(`${API_URL}/custom-views/category-heatmap`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.response?.data?.error || e.message));
  }, []);

  if (err) return <div className="card" style={{ padding: 24, color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return <div className="card" style={{ padding: 24 }}>Loading heatmap…</div>;

  const cellLookup = new Map(data.cells.map((c) => [`${c.industry}|${c.sentiment}`, c]));

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Use-case Category Heatmap</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
        Industries × testimonial-sentiment dimensions. Hover for counts.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: 6, fontSize: 11, color: '#64748b', textAlign: 'left' }}></th>
              {data.x_axis.map((x) => (
                <th key={x} style={{ padding: 6, fontSize: 11, color: '#475569', fontWeight: 600 }}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.y_axis.map((y) => (
              <tr key={y}>
                <td style={{ padding: 6, fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{y}</td>
                {data.x_axis.map((x) => {
                  const cell = cellLookup.get(`${y}|${x}`) || { intensity: 0, count: 0 };
                  return (
                    <td key={`${y}|${x}`} style={{ padding: 2 }}>
                      <div
                        title={`${y} · ${x} — count ${cell.count}`}
                        style={{
                          height: 36,
                          minWidth: 56,
                          background: colorFor(cell.intensity),
                          border: '1px solid #e2e8f0',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          color: cell.intensity > 60 ? 'white' : '#1e293b',
                          fontWeight: 600,
                        }}
                      >
                        {cell.count}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
