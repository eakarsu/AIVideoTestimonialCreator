import React from 'react';
import CollectionChart from '../components/CollectionChart';
import CategoryHeatmap from '../components/CategoryHeatmap';
import EditBriefPdf from '../components/EditBriefPdf';
import RecordingTemplateRulesEditor from '../components/RecordingTemplateRulesEditor';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">Testimonial Views</h1>
      </div>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>
        Curated custom views for testimonial collection analytics, briefs and recording-template rules.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <CollectionChart />
        <CategoryHeatmap />
        <EditBriefPdf />
        <RecordingTemplateRulesEditor />
      </div>
    </div>
  );
}
