import React, { useState, useEffect, createContext, useContext, useCallback, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
// === Batch 08 Gaps & Frontend Mounts ===
import CfTestimonialQualityScorerEmotionalImpactClarityLength from './pages/CfTestimonialQualityScorerEmotionalImpactClarityLength'
import CfEmotionalToneAndBodyLanguageAnalysisFor from './pages/CfEmotionalToneAndBodyLanguageAnalysisFor'
import CfAutoEditingAssistantSuggestingCutsPacingAdjustments from './pages/CfAutoEditingAssistantSuggestingCutsPacingAdjustments'
import CfTranscriptionWithEmotionSentimentMarkersTimelineAligned from './pages/CfTranscriptionWithEmotionSentimentMarkersTimelineAligned'
import CfTestimonialCampaignOptimizerRecommendingSelectionAndOrdering from './pages/CfTestimonialCampaignOptimizerRecommendingSelectionAndOrdering'
import CfRealTimeRecordingCoachGivingFeedbackDuring from './pages/CfRealTimeRecordingCoachGivingFeedbackDuring'
import GapAiIsActuallySubstantial18EndpointsTsv from './pages/GapAiIsActuallySubstantial18EndpointsTsv'
import GapNoVisionBasedBodyLanguageAnalysisBeyond from './pages/GapNoVisionBasedBodyLanguageAnalysisBeyond'
import GapNoRealTimeRecordingCoachDuringCapture from './pages/GapNoRealTimeRecordingCoachDuringCapture'
import GapNoNativeLinkedinTiktokPublishing from './pages/GapNoNativeLinkedinTiktokPublishing'
import GapNoCollaborationCommentingOnDraftTestimonials from './pages/GapNoCollaborationCommentingOnDraftTestimonials'
import GapLimitedMultiApproverWorkflowSingleApprovalsRoute from './pages/GapLimitedMultiApproverWorkflowSingleApprovalsRoute'
import GapNoWebhookNotificationsForApprovalStateChanges from './pages/GapNoWebhookNotificationsForApprovalStateChanges'
import GapNoMultiTenantWhiteLabelSupport from './pages/GapNoMultiTenantWhiteLabelSupport'
import CustomViewsPage from './pages/CustomViewsPage'

// API Configuration
const API_URL = 'http://localhost:3001/api';

// Auth Context
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// Toast Context
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', color: 'white', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'slideIn 0.3s ease', background: t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#f59e0b' : '#3b82f6', minWidth: '250px' }}>
            {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : t.type === 'warning' ? '⚠ ' : 'ℹ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Confirm Dialog Component
const ConfirmDialog = ({ isOpen, title, message, confirmText, cancelText, danger, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={onCancel}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1.125rem' }}>{title || 'Confirm'}</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{message || 'Are you sure?'}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>{cancelText || 'Cancel'}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={onConfirm}>{confirmText || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

// Error Boundary
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>An unexpected error occurred. Please try again.</p>
            <button className="btn btn-primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>Reload App</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Axios instance with auth
const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Styles
const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }

  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .login-card {
    background: white;
    padding: 3rem;
    border-radius: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    width: 100%;
    max-width: 420px;
  }

  .login-title {
    font-size: 1.75rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .login-subtitle { text-align: center; color: #64748b; margin-bottom: 2rem; }
  .form-group { margin-bottom: 1.25rem; }
  .form-label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: #475569; }

  .form-input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 0.75rem;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    width: 100%;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5);
  }

  .btn-secondary { background: #f1f5f9; color: #475569; }
  .btn-secondary:hover { background: #e2e8f0; }
  .btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; }
  .btn-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
  .btn-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; }
  .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }

  .auto-fill-btn {
    margin-top: 1rem;
    background: #f1f5f9;
    color: #667eea;
    border: 2px dashed #667eea;
  }

  .auto-fill-btn:hover { background: #667eea; color: white; border-style: solid; }

  .sample-data-btn {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    position: relative;
    overflow: hidden;
  }

  .sample-data-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px -4px rgba(245, 158, 11, 0.5);
  }

  .sample-data-btn::before {
    content: '\u2728';
    margin-right: 0.4rem;
  }

  .layout { display: flex; min-height: 100vh; }

  .sidebar {
    width: 280px;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    color: white;
    position: fixed;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .sidebar-logo { font-size: 1.25rem; font-weight: 700; padding: 1.5rem; padding-bottom: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid #334155; flex-shrink: 0; }

  .sidebar nav { flex: 1; overflow-y: auto; padding: 0.5rem 1.5rem; }

  .nav-section { margin-bottom: 1.5rem; }
  .nav-section-title { font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; padding-left: 1rem; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }

  .nav-item:hover, .nav-item.active { background: rgba(102, 126, 234, 0.1); color: white; }
  .nav-item.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }

  .main-content { flex: 1; margin-left: 280px; padding: 2rem; }

  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
  .page-title { font-size: 1.75rem; font-weight: 700; color: #1e293b; }

  .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }

  .stat-card {
    background: white;
    border-radius: 1rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;
  }

  .stat-card:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -10px rgba(0,0,0,0.15); border-color: #667eea; }

  .stat-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .stat-card-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
  .stat-card-label { color: #64748b; font-weight: 500; font-size: 0.85rem; }

  .card { background: white; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  .card-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 1.125rem; font-weight: 600; }

  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { padding: 1rem 1.5rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
  .table th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .table tr { cursor: pointer; transition: background 0.2s; }
  .table tr:hover { background: #f8fafc; }

  .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .badge-success { background: #d1fae5; color: #059669; }
  .badge-warning { background: #fef3c7; color: #d97706; }
  .badge-info { background: #dbeafe; color: #2563eb; }
  .badge-danger { background: #fee2e2; color: #dc2626; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; border-radius: 1rem; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
  .modal-header { padding: 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .modal-title { font-size: 1.25rem; font-weight: 600; }
  .modal-body { padding: 1.5rem; }
  .modal-footer { padding: 1.5rem; border-top: 1px solid #e2e8f0; display: flex; gap: 0.75rem; justify-content: flex-end; }
  .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }

  .detail-grid { display: grid; gap: 1rem; }
  .detail-item { padding: 1rem; background: #f8fafc; border-radius: 0.75rem; }
  .detail-label { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  .detail-value { color: #1e293b; font-weight: 500; }

  .ai-result { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 1rem; padding: 1.5rem; margin-top: 1rem; }
  .ai-result-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; font-weight: 600; color: #0369a1; }

  .ai-output-container { background: white; border-radius: 0.75rem; padding: 1.5rem; border: 1px solid #e0f2fe; }
  .ai-output-section { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; }
  .ai-output-section:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .ai-output-title { font-size: 0.85rem; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
  .ai-output-content { color: #334155; line-height: 1.7; font-size: 0.95rem; }
  .ai-output-content ul { margin-left: 1.25rem; margin-top: 0.5rem; }
  .ai-output-content li { margin-bottom: 0.5rem; }
  .ai-output-highlight { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; }
  .ai-output-quote { border-left: 4px solid #667eea; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #475569; }
  .ai-output-tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; margin: 0.25rem; }

  .ai-result-meta { display: flex; gap: 1.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #bae6fd; font-size: 0.8rem; color: #64748b; flex-wrap: wrap; }
  .ai-result-meta-item { display: flex; align-items: center; gap: 0.5rem; background: white; padding: 0.5rem 1rem; border-radius: 9999px; }

  .rating-stars { color: #f59e0b; font-size: 1.125rem; }

  .textarea { width: 100%; padding: 0.875rem 1rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; font-size: 1rem; font-family: inherit; resize: vertical; min-height: 120px; }
  .textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }

  .select { width: 100%; padding: 0.875rem 1rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; font-size: 1rem; background: white; cursor: pointer; }
  .select:focus { outline: none; border-color: #667eea; }

  .ai-tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; }

  .ai-tool-card {
    background: white;
    border-radius: 1rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: all 0.3s;
    cursor: pointer;
    border: 2px solid transparent;
  }

  .ai-tool-card:hover { transform: translateY(-4px); border-color: #667eea; }
  .ai-tool-icon { width: 48px; height: 48px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 0.75rem; }
  .ai-tool-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.35rem; }
  .ai-tool-description { color: #64748b; font-size: 0.85rem; }

  .history-panel { margin-top: 1.5rem; }
  .history-item {
    background: white;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }
  .history-item:hover { border-color: #667eea; transform: translateY(-1px); }
  .history-item.active { border-color: #667eea; background: #f0f4ff; }
  .history-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .history-item-tool { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
  .history-item-time { font-size: 0.75rem; color: #94a3b8; }
  .history-item-summary { font-size: 0.85rem; color: #64748b; line-height: 1.4; }
  .history-item-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
  .history-item-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #94a3b8; }
  .history-delete-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    transition: all 0.2s;
  }
  .history-delete-btn:hover { color: #ef4444; background: #fee2e2; }
  .history-empty { text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.9rem; }
  .btn-history {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
  }
  .btn-history:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -4px rgba(99, 102, 241, 0.5); }
  .btn-history.active { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3); }

  .sidebar-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #334155;
    background: rgba(15, 23, 42, 0.6);
    flex-shrink: 0;
  }

  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .sidebar-user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .sidebar-user-info {
    flex: 1;
    min-width: 0;
  }

  .sidebar-user-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-user-email {
    font-size: 0.7rem;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-logout-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sidebar-logout-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .sidebar-logout-btn svg {
    width: 18px;
    height: 18px;
  }
  .empty-state { text-align: center; padding: 3rem; color: #64748b; }
  .loading { display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .wizard-steps { display: flex; justify-content: space-between; margin-bottom: 2rem; position: relative; }
  .wizard-steps::before { content: ''; position: absolute; top: 20px; left: 50px; right: 50px; height: 2px; background: #e2e8f0; z-index: 0; }
  .wizard-step { display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1; }
  .wizard-step-number { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; background: #e2e8f0; color: #64748b; margin-bottom: 0.5rem; }
  .wizard-step.active .wizard-step-number { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
  .wizard-step.completed .wizard-step-number { background: #10b981; color: white; }
  .wizard-step-label { font-size: 0.875rem; color: #64748b; }
  .wizard-step.active .wizard-step-label { color: #667eea; font-weight: 600; }

  .selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
  .selection-card { padding: 1rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s; }
  .selection-card:hover { border-color: #667eea; }
  .selection-card.selected { border-color: #667eea; background: #f0f4ff; }
  .selection-card-title { font-weight: 600; margin-bottom: 0.25rem; }
  .selection-card-subtitle { font-size: 0.875rem; color: #64748b; }

  .chart-container { padding: 1.5rem; }
  .chart-bar { display: flex; align-items: center; margin-bottom: 0.75rem; }
  .chart-bar-label { width: 120px; font-size: 0.875rem; color: #475569; }
  .chart-bar-track { flex: 1; height: 24px; background: #e2e8f0; border-radius: 0.5rem; overflow: hidden; }
  .chart-bar-fill { height: 100%; border-radius: 0.5rem; display: flex; align-items: center; padding-left: 0.75rem; color: white; font-size: 0.75rem; font-weight: 600; }
  .chart-bar-value { margin-left: 0.75rem; font-weight: 600; color: #1e293b; min-width: 40px; }

  .tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem; }
  .tab { padding: 0.75rem 1.5rem; cursor: pointer; color: #64748b; font-weight: 500; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
  .tab:hover { color: #667eea; }
  .tab.active { color: #667eea; border-bottom-color: #667eea; }

  .settings-section { margin-bottom: 2rem; }
  .settings-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }

  .flex-row { display: flex; gap: 1rem; flex-wrap: wrap; }
  .flex-1 { flex: 1; min-width: 200px; }

  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .search-bar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
  .search-input { padding: 0.625rem 1rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.9rem; min-width: 220px; }
  .search-input:focus { outline: none; border-color: #667eea; }
  .filter-select { padding: 0.625rem 0.75rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.85rem; background: white; }

  .table th.sortable { cursor: pointer; user-select: none; position: relative; }
  .table th.sortable:hover { color: #667eea; }
  .sort-indicator { margin-left: 0.25rem; font-size: 0.7rem; }

  .pagination { display: flex; align-items: center; gap: 0.5rem; justify-content: center; padding: 1rem; }
  .pagination button { padding: 0.5rem 0.875rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; cursor: pointer; font-size: 0.85rem; }
  .pagination button:hover:not(:disabled) { border-color: #667eea; color: #667eea; }
  .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
  .pagination button.active { background: #667eea; color: white; border-color: #667eea; }
  .pagination-info { color: #64748b; font-size: 0.85rem; }

  .bulk-bar { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: #eef2ff; border-radius: 0.75rem; margin-bottom: 1rem; }
  .bulk-bar span { font-weight: 600; color: #4338ca; font-size: 0.9rem; }
  .checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #667eea; }

  .skeleton { background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 0.5rem; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .skeleton-row { display: flex; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
  .skeleton-cell { height: 1rem; flex: 1; }

  .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; }
  .empty-state-title { font-size: 1.125rem; font-weight: 600; color: #1e293b; margin-bottom: 0.5rem; }
  .empty-state-desc { color: #64748b; margin-bottom: 1.5rem; }

  .form-error { color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem; }
  .form-input.invalid { border-color: #ef4444; }

  .hamburger { display: none; position: fixed; top: 1rem; left: 1rem; z-index: 1100; background: #1e293b; color: white; border: none; border-radius: 0.5rem; padding: 0.75rem; cursor: pointer; font-size: 1.25rem; }

  .loading-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; z-index: 10; border-radius: 1rem; }

  .link-btn { background: none; border: none; color: #667eea; cursor: pointer; font-size: 0.9rem; text-decoration: underline; padding: 0; }
  .link-btn:hover { color: #4338ca; }

  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); z-index: 1050; transition: transform 0.3s ease; }
    .sidebar.open { transform: translateX(0); }
    .hamburger { display: block; }
    .main-content { margin-left: 0; padding: 1rem; padding-top: 4rem; }
    .page-header { flex-direction: column; align-items: flex-start; }
    .dashboard-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .table th, .table td { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
    .modal { max-width: 95vw; margin: 0.5rem; }
    .wizard-steps { flex-wrap: wrap; gap: 0.5rem; }
    .wizard-steps::before { display: none; }
    .ai-tools-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .selection-grid { grid-template-columns: 1fr; }
    .search-bar { flex-direction: column; align-items: stretch; }
    .btn-primary { width: 100%; }
  }
  @media (min-width: 769px) and (max-width: 1024px) {
    .sidebar { width: 220px; }
    .main-content { margin-left: 220px; padding: 1.5rem; }
    .dashboard-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
  }
`;

// Login Page
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  const autoFill = () => {
    setEmail('demo@example.com');
    setPassword('password123');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">AI Video Testimonials</h1>
        <p className="login-subtitle">Turn reviews into stunning video content</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          {error && <p style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          <button type="button" className="btn auto-fill-btn" onClick={autoFill}>Auto-fill Demo Credentials</button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="link-btn" onClick={() => navigate('/register')}>Don't have an account? Sign Up</button>
          <button className="link-btn" onClick={() => navigate('/forgot-password')}>Forgot Password?</button>
        </div>
      </div>
    </div>
  );
};

// Register Page
const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/register`, { name, email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Create Account</h1>
        <p className="login-subtitle">Join AI Video Testimonials</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className={`form-input ${errors.name ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className={`form-input ${errors.email ? 'invalid' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className={`form-input ${errors.password ? 'invalid' : ''}`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className={`form-input ${errors.confirmPassword ? 'invalid' : ''}`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
          </div>
          {error && <p style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating account...' : 'Sign Up'}</button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="link-btn" onClick={() => navigate('/login')}>Already have an account? Sign In</button>
        </div>
      </div>
    </div>
  );
};

// Forgot Password Page
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setMessage(res.data.message);
    } catch (err) {
      setError('Failed to send reset link');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Reset Password</h1>
        <p className="login-subtitle">Enter your email to receive a reset link</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          {error && <p style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          {message && <p style={{ color: '#10b981', marginBottom: '1rem', textAlign: 'center' }}>{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="link-btn" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    </div>
  );
};

// Reset Password Page
const ResetPasswordPage = () => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, { token, password });
      setMessage(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">New Password</h1>
        <p className="login-subtitle">Enter your reset token and new password</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Reset Token</label>
            <input type="text" className="form-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your reset token" required />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" required />
          </div>
          {error && <p style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          {message && <p style={{ color: '#10b981', marginBottom: '1rem', textAlign: 'center' }}>{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="link-btn" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ currentPage, onNavigate, isOpen, onToggle }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navSections = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'create-video', label: 'Create Video', icon: '✨' },
      ]
    },
    {
      title: 'Content',
      items: [
        { id: 'reviews', label: 'Reviews', icon: '⭐' },
        { id: 'scripts', label: 'Scripts', icon: '📝' },
        { id: 'videos', label: 'Videos', icon: '🎬' },
      ]
    },
    {
      title: 'Assets',
      items: [
        { id: 'avatars', label: 'AI Avatars', icon: '🤖' },
        { id: 'templates', label: 'Templates', icon: '🎨' },
        { id: 'voiceovers', label: 'Voiceovers', icon: '🎙️' },
      ]
    },
    {
      title: 'AI Features',
      items: [
        { id: 'ai-tools', label: 'AI Tools', icon: '🧠' },
        { id: 'provider-render', label: 'Provider Render', icon: '🎥' },
        { id: 'interview-questions', label: 'Interview Questions', icon: '❓' },
        { id: 'sports-highlights', label: 'Sports Highlights', icon: '🏆' },
        { id: 'highlights', label: 'Highlights', icon: '✂️' },
        { id: 'broll-suggestions', label: 'B-Roll Suggester', icon: '🎞️' },
        { id: 'music-matches', label: 'Music Matcher', icon: '🎵' },
        { id: 'transcripts', label: 'Transcripts', icon: '📄' },
      ]
    },
    {
      title: 'Analytics',
      items: [
        { id: 'analytics', label: 'Analytics', icon: '📈' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
      ]
    },
    {
      title: 'Custom Views',
      items: [
        { id: 'custom-views', label: 'Testimonial Views', icon: '🗂️', path: '/custom-views' },
      ]
    }
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  const userRole = user?.role || 'editor';

  // Filter settings to admin only
  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.id === 'settings' && userRole === 'viewer') return false;
      return true;
    })
  }));

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">🎬 Video Testimonials</div>
      <nav>
        {filteredSections.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            {section.items.map((item) => (
              <div key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`} onClick={() => { if (item.path) { navigate(item.path); } else { onNavigate(item.id); } if (onToggle) onToggle(); }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-email">{user?.email || ''}{userRole !== 'editor' ? ` (${userRole})` : ''}</div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Sign out">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children, footer, wide }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: '900px' } : {}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// Professional AI Result Display Component
const AIResultDisplay = ({ result, loading }) => {
  if (loading) return <div className="ai-result"><div className="loading"><div className="spinner"></div></div></div>;
  if (!result) return null;

  const content = result.script || result.enhanced_review || result.suggestions || result.analysis || result.metadata || result.cta_options || result.translation || result.template_suggestions || result.package || result.variations || result.questions || result.highlights || result.broll_suggestions || result.music_suggestions || result.transcript;

  // Parse and format the AI output professionally
  const formatContent = (text) => {
    if (!text) return null;

    const sections = [];
    const lines = text.split('\n');
    let currentSection = { title: '', content: [] };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Check if it's a header (starts with number, #, or all caps with colon)
      if (/^(\d+\.|#{1,3}|[A-Z][A-Z\s]+:)/.test(trimmedLine) && trimmedLine.length < 80) {
        if (currentSection.content.length > 0 || currentSection.title) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/^(\d+\.|#{1,3}\s*)/, '').replace(/:$/, '').trim(),
          content: []
        };
      } else if (trimmedLine) {
        currentSection.content.push(trimmedLine);
      }
    });

    if (currentSection.content.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      return <div className="ai-output-content">{text}</div>;
    }

    return sections.map((section, idx) => (
      <div key={idx} className="ai-output-section">
        {section.title && (
          <div className="ai-output-title">
            <span style={{ color: '#667eea' }}>{'>'}</span>
            {section.title}
          </div>
        )}
        <div className="ai-output-content">
          {section.content.map((line, lineIdx) => {
            // Format bullet points
            if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
              return <div key={lineIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: '#667eea' }}>•</span>
                <span>{line.replace(/^[-*•]\s*/, '')}</span>
              </div>;
            }
            // Format quoted text
            if (line.startsWith('"') || line.startsWith("'")) {
              return <div key={lineIdx} className="ai-output-quote">{line}</div>;
            }
            return <p key={lineIdx} style={{ marginBottom: '0.5rem' }}>{line}</p>;
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="ai-result">
      <div className="ai-result-header">
        <span style={{ fontSize: '1.5rem' }}>✨</span>
        <span>AI Generated Result</span>
        <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Success</span>
      </div>
      <div className="ai-output-container">
        {formatContent(content)}
      </div>
      <div className="ai-result-meta">
        <div className="ai-result-meta-item">
          <span>🤖</span>
          <span>Model: {result.model || 'Claude Haiku'}</span>
        </div>
        {result.usage && (
          <div className="ai-result-meta-item">
            <span>📊</span>
            <span>Tokens: {result.usage.total_tokens}</span>
          </div>
        )}
        <div className="ai-result-meta-item">
          <span>⏱️</span>
          <span>Generated: {new Date(result.generatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

// Dashboard Page
const DashboardPage = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/stats').then(res => { setStats(res.data); setLoading(false); }).catch(() => { setLoading(false); toast?.showToast('Failed to load stats', 'error'); });
  }, []);

  const mainCards = [
    { id: 'reviews', label: 'Reviews', count: stats?.reviews || 0, icon: '⭐', color: '#f59e0b', bg: '#fef3c7' },
    { id: 'avatars', label: 'AI Avatars', count: stats?.avatars || 0, icon: '🤖', color: '#8b5cf6', bg: '#ede9fe' },
    { id: 'templates', label: 'Templates', count: stats?.templates || 0, icon: '🎨', color: '#ec4899', bg: '#fce7f3' },
    { id: 'scripts', label: 'Scripts', count: stats?.scripts || 0, icon: '📝', color: '#10b981', bg: '#d1fae5' },
    { id: 'voiceovers', label: 'Voiceovers', count: stats?.voiceovers || 0, icon: '🎙️', color: '#06b6d4', bg: '#cffafe' },
    { id: 'videos', label: 'Videos', count: stats?.videos || 0, icon: '🎬', color: '#667eea', bg: '#e0e7ff' },
  ];

  const aiFeatureCards = [
    { id: 'interview-questions', label: 'Interview Q\'s', count: stats?.interviewQuestions || 0, icon: '❓', color: '#ef4444', bg: '#fee2e2' },
    { id: 'sports-highlights', label: 'Sports Clips', count: stats?.sportsHighlights || 0, icon: '🏆', color: '#22c55e', bg: '#dcfce7' },
    { id: 'highlights', label: 'Highlights', count: stats?.highlights || 0, icon: '✂️', color: '#3b82f6', bg: '#dbeafe' },
    { id: 'broll-suggestions', label: 'B-Roll', count: stats?.brollSuggestions || 0, icon: '🎞️', color: '#a855f7', bg: '#f3e8ff' },
    { id: 'music-matches', label: 'Music', count: stats?.musicMatches || 0, icon: '🎵', color: '#f97316', bg: '#ffedd5' },
    { id: 'transcripts', label: 'Transcripts', count: stats?.transcripts || 0, icon: '📄', color: '#14b8a6', bg: '#ccfbf1' },
  ];

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="dashboard-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card" style={{ minHeight: '100px' }}>
            <div className="skeleton" style={{ width: '40px', height: '40px', marginBottom: '0.75rem' }}></div>
            <div className="skeleton" style={{ width: '50px', height: '1.5rem', marginBottom: '0.5rem' }}></div>
            <div className="skeleton" style={{ width: '80px', height: '1rem' }}></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>

      <h3 style={{ marginBottom: '1rem', color: '#475569' }}>Core Content</h3>
      <div className="dashboard-grid">
        {mainCards.map((card) => (
          <div key={card.id} className="stat-card" onClick={() => onNavigate(card.id)}>
            <div className="stat-card-icon" style={{ background: card.bg, color: card.color }}>{card.icon}</div>
            <div className="stat-card-value">{card.count}</div>
            <div className="stat-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: '1rem', marginTop: '2rem', color: '#475569' }}>AI Features</h3>
      <div className="dashboard-grid">
        {aiFeatureCards.map((card) => (
          <div key={card.id} className="stat-card" onClick={() => onNavigate(card.id)}>
            <div className="stat-card-icon" style={{ background: card.bg, color: card.color }}>{card.icon}</div>
            <div className="stat-card-value">{card.count}</div>
            <div className="stat-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('create-video')}>Create New Video</button>
          <button className="btn btn-success" onClick={() => onNavigate('ai-tools')}>AI Tools</button>
          <button className="btn btn-secondary" onClick={() => onNavigate('analytics')}>View Analytics</button>
        </div>
      </div>
    </div>
  );
};

// API Select Component
const ApiSelect = ({ field, value, onChange }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/${field.apiEndpoint}?limit=100`).then(res => {
      const data = res.data.data || res.data;
      setOptions(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [field.apiEndpoint]);

  if (loading) return <select className="select" disabled><option>Loading...</option></select>;

  return (
    <select className="select" value={value || ''} onChange={onChange} required={field.required}>
      <option value="">Select {field.label}...</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt[field.displayField]}{field.displayField2 ? ` - ${opt[field.displayField2]}` : ''}
        </option>
      ))}
    </select>
  );
};

// Skeleton Loader
const SkeletonTable = ({ cols = 5, rows = 5 }) => (
  <div>{Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="skeleton-row">{Array.from({ length: cols }).map((_, j) => (
      <div key={j} className="skeleton skeleton-cell" style={{ height: '1rem' }}></div>
    ))}</div>
  ))}</div>
);

// Empty State Component
const EmptyState = ({ icon, title, description, actionLabel, onAction }) => (
  <div style={{ textAlign: 'center', padding: '3rem' }}>
    <div className="empty-state-icon">{icon || '📭'}</div>
    <div className="empty-state-title">{title || 'No items yet'}</div>
    <div className="empty-state-desc">{description || 'Get started by creating your first item.'}</div>
    {actionLabel && onAction && <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>}
  </div>
);

// Generic List Page Component
const ListPage = ({ title, endpoint, columns, formFields, cardIcon, filterOptions }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { user } = useAuth();
  const toast = useToast();
  const userRole = user?.role || 'editor';
  const canEdit = userRole !== 'viewer';

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchDebounced) params.set('search', searchDebounced);
      if (sortBy) { params.set('sort_by', sortBy); params.set('sort_order', sortOrder); }
      params.set('page', page);
      params.set('limit', 10);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(`filter_${k}`, v); });
      const res = await api.get(`/${endpoint}?${params.toString()}`);
      if (res.data.data) {
        setItems(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotal(res.data.total || 0);
      } else {
        setItems(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast?.showToast('Failed to load data', 'error');
    }
    setLoading(false);
  }, [endpoint, searchDebounced, sortBy, sortOrder, page, filters]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [searchDebounced, filters]);

  const handleRowClick = (item) => { setSelectedItem(item); setIsDetailOpen(true); };
  const handleEdit = () => { setFormData(selectedItem); setFormErrors({}); setIsEditing(true); setIsDetailOpen(false); setIsFormOpen(true); };

  const handleDelete = () => {
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/${endpoint}/${selectedItem.id}`);
        setIsDetailOpen(false);
        toast?.showToast('Item deleted successfully', 'success');
        fetchItems();
      } catch { toast?.showToast('Failed to delete', 'error'); }
    });
    setConfirmOpen(true);
  };

  const handleNew = () => { setFormData({}); setFormErrors({}); setIsEditing(false); setIsFormOpen(true); };

  const validateForm = () => {
    const errors = {};
    formFields.forEach(f => {
      const val = formData[f.key];
      if (f.required && (!val || !String(val).trim())) errors[f.key] = `${f.label} is required`;
      if (f.type === 'email' && val && !/\S+@\S+\.\S+/.test(val)) errors[f.key] = 'Invalid email';
      if (f.type === 'number' && val) {
        const num = Number(val);
        if (f.key === 'rating' && (num < 1 || num > 5)) errors[f.key] = 'Rating must be 1-5';
        if (f.key === 'importance_score' && (num < 0 || num > 100)) errors[f.key] = 'Score must be 0-100';
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormSubmitting(true);
    try {
      if (isEditing) await api.put(`/${endpoint}/${formData.id}`, formData);
      else await api.post(`/${endpoint}`, formData);
      setIsFormOpen(false);
      toast?.showToast(isEditing ? 'Item updated successfully' : 'Item created successfully', 'success');
      fetchItems();
    } catch (err) {
      toast?.showToast('Failed to save item', 'error');
    }
    setFormSubmitting(false);
  };

  const handleSort = (colKey) => {
    if (sortBy === colKey) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(colKey); setSortOrder('asc'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === items.length ? [] : items.map(i => i.id));
  };

  const handleBulkDelete = () => {
    setConfirmAction(() => async () => {
      try {
        await api.post(`/${endpoint}/bulk-delete`, { ids: selectedIds });
        setSelectedIds([]);
        toast?.showToast(`${selectedIds.length} items deleted`, 'success');
        fetchItems();
      } catch { toast?.showToast('Bulk delete failed', 'error'); }
    });
    setConfirmOpen(true);
  };

  const handleBulkExport = () => {
    const selected = items.filter(i => selectedIds.includes(i.id));
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${endpoint}_selected.json`; a.click();
    toast?.showToast('Exported selected items', 'success');
  };

  const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...';
    return value.toString().substring(0, 50) + (value.toString().length > 50 ? '...' : '');
  };

  const entityNames = { reviews: 'Review', avatars: 'Avatar', templates: 'Template', scripts: 'Script', voiceovers: 'Voiceover', videos: 'Video', 'interview-questions': 'Question', 'sports-highlights': 'Highlight', highlights: 'Highlight', 'broll-suggestions': 'Suggestion', 'music-matches': 'Match', transcripts: 'Transcript' };
  const entityName = entityNames[endpoint] || 'Item';

  return (
    <div>
      <ConfirmDialog isOpen={confirmOpen} title="Delete Confirmation" message={`Are you sure you want to delete? This action cannot be undone.`} confirmText="Delete" danger onConfirm={() => { setConfirmOpen(false); confirmAction?.(); }} onCancel={() => setConfirmOpen(false)} />

      <div className="page-header">
        <h1 className="page-title">{cardIcon} {title}</h1>
        {canEdit && <button className="btn btn-primary" onClick={handleNew}>+ Add New</button>}
      </div>

      <div className="search-bar">
        <input className="search-input" type="text" placeholder={`Search ${title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        {filterOptions && filterOptions.map(fo => (
          <select key={fo.key} className="filter-select" value={filters[fo.key] || ''} onChange={(e) => setFilters({ ...filters, [fo.key]: e.target.value })}>
            <option value="">{fo.label}: All</option>
            {fo.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {selectedIds.length > 0 && canEdit && (
        <div className="bulk-bar">
          <span>{selectedIds.length} selected</span>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
          <button className="btn btn-secondary btn-sm" onClick={handleBulkExport}>Export Selected</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
        </div>
      )}

      <div className="card">
        {loading ? <SkeletonTable cols={columns.length + (canEdit ? 1 : 0)} /> : (
          <>
            <table className="table">
              <thead><tr>
                {canEdit && <th style={{ width: '40px' }}><input type="checkbox" className="checkbox" checked={items.length > 0 && selectedIds.length === items.length} onChange={toggleSelectAll} /></th>}
                {columns.map((col) => (
                  <th key={col.key} className="sortable" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortBy === col.key && <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {canEdit && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} /></td>}
                    {columns.map((col) => (
                      <td key={col.key} onClick={() => handleRowClick(item)}>
                        {col.key === 'rating' ? <span className="rating-stars">{renderStars(item[col.key])}</span> :
                         col.key === 'status' ? <span className={`badge ${item[col.key] === 'completed' ? 'badge-success' : item[col.key] === 'rendering' ? 'badge-warning' : 'badge-info'}`}>{item[col.key]}</span> :
                         col.render ? col.render(item) : formatValue(item[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && !searchDebounced && Object.values(filters).every(v => !v) && (
              <EmptyState icon={cardIcon} title={`No ${title} yet`} description={`Create your first ${entityName.toLowerCase()} to get started.`} actionLabel={canEdit ? `+ Create ${entityName}` : undefined} onAction={canEdit ? handleNew : undefined} />
            )}
            {items.length === 0 && (searchDebounced || Object.values(filters).some(v => v)) && (
              <EmptyState icon="🔍" title="No results found" description="Try adjusting your search or filters." />
            )}
          </>
        )}
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            <span className="pagination-info">{total} total</span>
          </div>
        )}
      </div>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Details" footer={
        <><button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>Close</button>
        {canEdit && <button className="btn btn-primary" onClick={handleEdit}>Edit</button>}
        {canEdit && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}</>
      }>
        {selectedItem && (
          <div className="detail-grid">
            {Object.entries(selectedItem).map(([key, value]) => key !== 'password_hash' && (
              <div key={key} className="detail-item">
                <div className="detail-label">{key.replace(/_/g, ' ')}</div>
                <div className="detail-value">
                  {key === 'rating' ? <span className="rating-stars">{renderStars(value)}</span> :
                   typeof value === 'object' ? <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify(value, null, 2)}</pre> :
                   value?.toString() || '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={isEditing ? `Edit ${entityName}` : `Add New ${entityName}`}>
        <div style={{ position: 'relative' }}>
          {formSubmitting && <div className="loading-overlay"><div className="spinner"></div></div>}
          <form onSubmit={handleSubmit}>
            {formFields.map((field) => (
              <div key={field.key} className="form-group">
                <label className="form-label">{field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}</label>
                {field.type === 'textarea' ? <textarea className={`textarea ${formErrors[field.key] ? 'invalid' : ''}`} value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} /> :
                 field.type === 'select' ? <select className="select" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}><option value="">Select...</option>{field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> :
                 field.type === 'api-select' ? <ApiSelect field={field} value={formData[field.key]} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} /> :
                 <input type={field.type || 'text'} className={`form-input ${formErrors[field.key] ? 'invalid' : ''}`} value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} />}
                {formErrors[field.key] && <div className="form-error">{formErrors[field.key]}</div>}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={formSubmitting}>{formSubmitting ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

// Page Components
const ReviewsPage = () => <ListPage title="Customer Reviews" endpoint="reviews" cardIcon="⭐" columns={[{ key: 'customer_name', label: 'Customer' }, { key: 'company', label: 'Company' }, { key: 'rating', label: 'Rating' }, { key: 'source', label: 'Source' }, { key: 'review_text', label: 'Review' }]} formFields={[{ key: 'customer_name', label: 'Customer Name', required: true }, { key: 'customer_email', label: 'Email', type: 'email' }, { key: 'company', label: 'Company' }, { key: 'rating', label: 'Rating (1-5)', type: 'number', required: true }, { key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'source', label: 'Source', type: 'select', options: ['Google Reviews', 'Trustpilot', 'G2 Crowd', 'Capterra', 'LinkedIn', 'Product Hunt', 'Software Advice', 'Manual Entry'] }]} filterOptions={[{ key: 'rating', label: 'Rating', options: ['1', '2', '3', '4', '5'] }, { key: 'source', label: 'Source', options: ['Google Reviews', 'Trustpilot', 'G2 Crowd', 'Capterra', 'LinkedIn', 'Product Hunt', 'Software Advice'] }]} />;

const AvatarsPage = () => <ListPage title="AI Avatars" endpoint="avatars" cardIcon="🤖" columns={[{ key: 'name', label: 'Name' }, { key: 'provider', label: 'Provider' }, { key: 'gender', label: 'Gender' }, { key: 'style', label: 'Style' }]} formFields={[{ key: 'name', label: 'Avatar Name', required: true }, { key: 'provider', label: 'Provider', type: 'select', options: ['HeyGen', 'D-ID', 'Synthesia'], required: true }, { key: 'avatar_id', label: 'Avatar ID' }, { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Non-binary'] }, { key: 'style', label: 'Style' }, { key: 'thumbnail_url', label: 'Thumbnail URL' }]} filterOptions={[{ key: 'provider', label: 'Provider', options: ['HeyGen', 'D-ID', 'Synthesia'] }, { key: 'gender', label: 'Gender', options: ['Male', 'Female', 'Non-binary'] }]} />;

const TemplatesPage = () => <ListPage title="Video Templates" endpoint="templates" cardIcon="🎨" columns={[{ key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'duration', label: 'Duration (s)' }, { key: 'animation_type', label: 'Animation' }]} formFields={[{ key: 'name', label: 'Template Name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }, { key: 'background_color', label: 'Background Color' }, { key: 'font_style', label: 'Font Style' }, { key: 'animation_type', label: 'Animation Type', type: 'select', options: ['Fade', 'Slide', 'Zoom', 'Bounce', 'Pop'] }, { key: 'category', label: 'Category', type: 'select', options: ['Corporate', 'Modern', 'Technology', 'Healthcare', 'Finance', 'Creative', 'Education', 'Retail', 'Hospitality', 'Manufacturing', 'Nonprofit', 'Real Estate', 'Fitness', 'Legal', 'E-commerce'] }]} />;

const ScriptsPage = () => <ListPage title="Video Scripts" endpoint="scripts" cardIcon="📝" columns={[{ key: 'title', label: 'Title' }, { key: 'tone', label: 'Tone' }, { key: 'word_count', label: 'Words' }, { key: 'content', label: 'Content' }]} formFields={[{ key: 'title', label: 'Script Title', required: true }, { key: 'content', label: 'Script Content', type: 'textarea', required: true }, { key: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Casual', 'Enthusiastic', 'Corporate', 'Dynamic', 'Formal', 'Energetic', 'Direct', 'Inspiring', 'Confident', 'Technical', 'Heartfelt', 'Straightforward', 'Warm', 'Results-focused'] }, { key: 'word_count', label: 'Word Count', type: 'number' }, { key: 'review_id', label: 'Review', type: 'api-select', apiEndpoint: 'reviews', displayField: 'customer_name', displayField2: 'company' }]} />;

const VoiceoversPage = () => <ListPage title="Voice Options" endpoint="voiceovers" cardIcon="🎙️" columns={[{ key: 'name', label: 'Name' }, { key: 'provider', label: 'Provider' }, { key: 'language', label: 'Language' }, { key: 'gender', label: 'Gender' }, { key: 'accent', label: 'Accent' }]} formFields={[{ key: 'name', label: 'Voice Name', required: true }, { key: 'voice_id', label: 'Voice ID' }, { key: 'provider', label: 'Provider', type: 'select', options: ['ElevenLabs', 'Amazon Polly', 'Google TTS'] }, { key: 'language', label: 'Language' }, { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] }, { key: 'accent', label: 'Accent' }, { key: 'sample_url', label: 'Sample URL' }]} />;

const VideosPage = () => <ListPage title="Generated Videos" endpoint="videos" cardIcon="🎬" columns={[{ key: 'title', label: 'Title' }, { key: 'customer_name', label: 'Customer' }, { key: 'avatar_name', label: 'Avatar' }, { key: 'template_name', label: 'Template' }, { key: 'status', label: 'Status' }, { key: 'duration', label: 'Duration (s)' }]} formFields={[{ key: 'title', label: 'Video Title', required: true }, { key: 'review_id', label: 'Review', type: 'api-select', apiEndpoint: 'reviews', displayField: 'customer_name', displayField2: 'company' }, { key: 'avatar_id', label: 'Avatar', type: 'api-select', apiEndpoint: 'avatars', displayField: 'name', displayField2: 'provider' }, { key: 'template_id', label: 'Template', type: 'api-select', apiEndpoint: 'templates', displayField: 'name', displayField2: 'category' }, { key: 'status', label: 'Status', type: 'select', options: ['pending', 'processing', 'rendering', 'completed', 'failed'] }, { key: 'video_url', label: 'Video URL' }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }]} filterOptions={[{ key: 'status', label: 'Status', options: ['pending', 'processing', 'rendering', 'completed', 'failed'] }]} />;

// New Feature Pages
const InterviewQuestionsPage = () => <ListPage title="Interview Questions" endpoint="interview-questions" cardIcon="❓" columns={[{ key: 'title', label: 'Title' }, { key: 'topic', label: 'Topic' }, { key: 'difficulty', label: 'Difficulty' }, { key: 'question_type', label: 'Type' }, { key: 'industry', label: 'Industry' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'topic', label: 'Topic' }, { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Medium', 'Hard'] }, { key: 'question_type', label: 'Question Type', type: 'select', options: ['Behavioral', 'Open-ended', 'Strategic', 'Experience', 'Service', 'Compliance', 'Security', 'Growth', 'Engagement', 'Results', 'Operational', 'Mission', 'Collaboration', 'Loyalty', 'Technical'] }, { key: 'context', label: 'Context', type: 'textarea' }, { key: 'industry', label: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Nonprofit', 'SaaS', 'Enterprise', 'Startup', 'Service', 'General'] }]} />;

const SportsHighlightsPage = () => <ListPage title="Sports Highlights" endpoint="sports-highlights" cardIcon="🏆" columns={[{ key: 'title', label: 'Title' }, { key: 'sport_type', label: 'Sport' }, { key: 'event_name', label: 'Event' }, { key: 'player_name', label: 'Player' }, { key: 'highlight_type', label: 'Type' }, { key: 'duration', label: 'Duration' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'sport_type', label: 'Sport Type', type: 'select', options: ['Soccer', 'Basketball', 'Baseball', 'Football', 'Hockey', 'Tennis', 'Track & Field', 'Boxing', 'Golf', 'MMA', 'Cricket', 'Rugby'] }, { key: 'event_name', label: 'Event Name' }, { key: 'team_name', label: 'Team Name' }, { key: 'player_name', label: 'Player Name' }, { key: 'highlight_type', label: 'Highlight Type', type: 'select', options: ['Goal', 'Shot', 'Home Run', 'Touchdown', 'Save', 'Ace', 'Race Finish', 'Knockout', 'Putt', 'Dunk', 'Performance', 'Match Point'] }, { key: 'start_time', label: 'Start Time' }, { key: 'end_time', label: 'End Time' }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'video_url', label: 'Video URL' }]} />;

const HighlightsPage = () => <ListPage title="Video Highlights" endpoint="highlights" cardIcon="✂️" columns={[{ key: 'title', label: 'Title' }, { key: 'source_type', label: 'Source' }, { key: 'content_type', label: 'Content Type' }, { key: 'importance_score', label: 'Score' }, { key: 'duration', label: 'Duration' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'source_type', label: 'Source Type', type: 'select', options: ['Conference', 'Webinar', 'Interview', 'Podcast', 'E-Learning', 'Documentary', 'Event', 'Live Stream', 'Meeting', 'Presentation'] }, { key: 'content_type', label: 'Content Type', type: 'select', options: ['Presentation', 'Demo', 'Testimonial', 'Discussion', 'Education', 'Culture', 'Speech', 'Announcement', 'Q&A', 'BTS', 'Story', 'Celebration', 'Technical', 'Quote', 'Case Study', 'Prediction'] }, { key: 'start_time', label: 'Start Time' }, { key: 'end_time', label: 'End Time' }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'importance_score', label: 'Importance Score (1-100)', type: 'number' }, { key: 'transcript_snippet', label: 'Transcript Snippet', type: 'textarea' }, { key: 'video_url', label: 'Video URL' }]} />;

const BRollSuggestionsPage = () => <ListPage title="B-Roll Suggestions" endpoint="broll-suggestions" cardIcon="🎞️" columns={[{ key: 'title', label: 'Title' }, { key: 'industry', label: 'Industry' }, { key: 'mood', label: 'Mood' }, { key: 'context', label: 'Context' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'context', label: 'Context', type: 'textarea' }, { key: 'industry', label: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance', 'Creative', 'Manufacturing', 'Retail', 'Education', 'Hospitality', 'Logistics', 'Nonprofit', 'SaaS', 'Real Estate', 'Fitness', 'Legal', 'E-commerce', 'Construction'] }, { key: 'mood', label: 'Mood', type: 'select', options: ['Energetic', 'Calm', 'Professional', 'Dynamic', 'Industrial', 'Welcoming', 'Inspiring', 'Luxurious', 'Efficient', 'Heartfelt', 'Modern', 'Aspirational', 'Authoritative'] }, { key: 'style_notes', label: 'Style Notes', type: 'textarea' }]} />;

const MusicMatchesPage = () => <ListPage title="Music Matches" endpoint="music-matches" cardIcon="🎵" columns={[{ key: 'title', label: 'Title' }, { key: 'content_type', label: 'Content Type' }, { key: 'mood', label: 'Mood' }, { key: 'genre', label: 'Genre' }, { key: 'tempo', label: 'Tempo' }, { key: 'energy_level', label: 'Energy' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'content_type', label: 'Content Type', type: 'select', options: ['Testimonial', 'Product Demo', 'Customer Story', 'Brand Video', 'Healthcare Content', 'Financial Services', 'Creative Agency', 'Retail Promo', 'Educational Content', 'Hotel Promo', 'Fitness Content', 'Legal Services', 'Charity Video', 'Online Shopping', 'Construction Promo', 'Software Demo'] }, { key: 'mood', label: 'Mood', type: 'select', options: ['Inspiring', 'Futuristic', 'Emotional', 'Energetic', 'Calm', 'Confident', 'Playful', 'Exciting', 'Curious', 'Luxurious', 'Motivating', 'Authoritative', 'Heartwarming', 'Trendy', 'Powerful', 'Professional'] }, { key: 'genre', label: 'Genre', type: 'select', options: ['Corporate', 'Electronic', 'Cinematic', 'Indie Pop', 'Ambient', 'Classical Fusion', 'Jazz Fusion', 'Pop Dance', 'Folk Acoustic', 'Lounge', 'EDM', 'Classical', 'Acoustic Piano', 'Trap Pop', 'Rock', 'Synth Pop'] }, { key: 'tempo', label: 'Tempo', type: 'select', options: ['Slow', 'Slow-Medium', 'Medium', 'Medium-Fast', 'Fast'] }, { key: 'energy_level', label: 'Energy Level', type: 'select', options: ['Low', 'Low-Medium', 'Medium', 'Medium-High', 'High', 'Very High'] }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }, { key: 'licensing_info', label: 'Licensing Info', type: 'textarea' }, { key: 'style_notes', label: 'Style Notes', type: 'textarea' }]} />;

const TranscriptsPage = () => <ListPage title="Transcripts" endpoint="transcripts" cardIcon="📄" columns={[{ key: 'title', label: 'Title' }, { key: 'source_type', label: 'Source' }, { key: 'language', label: 'Language' }, { key: 'duration', label: 'Duration (s)' }, { key: 'confidence_score', label: 'Confidence' }]} formFields={[{ key: 'title', label: 'Title', required: true }, { key: 'source_type', label: 'Source Type', type: 'select', options: ['Conference Call', 'Interview', 'Keynote', 'Training', 'Panel', 'Webinar', 'Podcast', 'Internal', 'Demo', 'Pitch', 'Support', 'Workshop', 'Meeting', 'Focus Group', 'Conference'] }, { key: 'language', label: 'Language', type: 'select', options: ['English', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin', 'Portuguese', 'Italian', 'Korean', 'Hindi'] }, { key: 'duration', label: 'Duration (seconds)', type: 'number' }, { key: 'content', label: 'Transcript Content', type: 'textarea' }, { key: 'summary', label: 'Summary', type: 'textarea' }, { key: 'confidence_score', label: 'Confidence Score (0-100)', type: 'number' }, { key: 'video_url', label: 'Video URL' }]} />;

// Video Creation Wizard
const CreateVideoPage = () => {
  const [step, setStep] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [voiceovers, setVoiceovers] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedVoiceover, setSelectedVoiceover] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/reviews?limit=100'), api.get('/avatars?limit=100'), api.get('/templates?limit=100'), api.get('/voiceovers?limit=100')])
      .then(([r, a, t, v]) => {
        setReviews(r.data.data || r.data);
        setAvatars(a.data.data || a.data);
        setTemplates(t.data.data || t.data);
        setVoiceovers(v.data.data || v.data);
      });
  }, []);

  const steps = [{ num: 1, label: 'Select Review' }, { num: 2, label: 'Choose Avatar' }, { num: 3, label: 'Pick Template' }, { num: 4, label: 'Add Voice' }, { num: 5, label: 'Generate' }];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/generate-video', {
        review_id: selectedReview.id,
        avatar_id: selectedAvatar.id,
        template_id: selectedTemplate.id,
        voiceover_id: selectedVoiceover?.id
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return (
    <div>
      <div className="page-header"><h1 className="page-title">✨ Create Video Testimonial</h1></div>

      <div className="wizard-steps">
        {steps.map((s) => (
          <div key={s.num} className={`wizard-step ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}>
            <div className="wizard-step-number">{step > s.num ? '✓' : s.num}</div>
            <div className="wizard-step-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '1.5rem' }}>
          {step === 1 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Select a Customer Review</h3>
              <div className="selection-grid">
                {reviews.map((review) => (
                  <div key={review.id} className={`selection-card ${selectedReview?.id === review.id ? 'selected' : ''}`} onClick={() => setSelectedReview(review)}>
                    <div className="selection-card-title">{review.customer_name}</div>
                    <div className="selection-card-subtitle">{review.company}</div>
                    <div className="rating-stars" style={{ fontSize: '0.875rem' }}>{renderStars(review.rating)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Choose an AI Avatar</h3>
              <div className="selection-grid">
                {avatars.map((avatar) => (
                  <div key={avatar.id} className={`selection-card ${selectedAvatar?.id === avatar.id ? 'selected' : ''}`} onClick={() => setSelectedAvatar(avatar)}>
                    <div className="selection-card-title">{avatar.name}</div>
                    <div className="selection-card-subtitle">{avatar.provider} - {avatar.gender}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{avatar.style}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Pick a Video Template</h3>
              <div className="selection-grid">
                {templates.map((template) => (
                  <div key={template.id} className={`selection-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`} onClick={() => setSelectedTemplate(template)}>
                    <div className="selection-card-title">{template.name}</div>
                    <div className="selection-card-subtitle">{template.category} - {template.duration}s</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{template.animation_type} animation</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Add Voice (Optional)</h3>
              <div className="selection-grid">
                <div className={`selection-card ${!selectedVoiceover ? 'selected' : ''}`} onClick={() => setSelectedVoiceover(null)}>
                  <div className="selection-card-title">Use Avatar Voice</div>
                  <div className="selection-card-subtitle">Default voice from avatar provider</div>
                </div>
                {voiceovers.map((voice) => (
                  <div key={voice.id} className={`selection-card ${selectedVoiceover?.id === voice.id ? 'selected' : ''}`} onClick={() => setSelectedVoiceover(voice)}>
                    <div className="selection-card-title">{voice.name}</div>
                    <div className="selection-card-subtitle">{voice.provider} - {voice.language}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{voice.gender} - {voice.accent}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Review & Generate</h3>
              <div className="detail-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="detail-item"><div className="detail-label">Review</div><div className="detail-value">{selectedReview?.customer_name} - {selectedReview?.company}</div></div>
                <div className="detail-item"><div className="detail-label">Avatar</div><div className="detail-value">{selectedAvatar?.name} ({selectedAvatar?.provider})</div></div>
                <div className="detail-item"><div className="detail-label">Template</div><div className="detail-value">{selectedTemplate?.name} - {selectedTemplate?.category}</div></div>
                <div className="detail-item"><div className="detail-label">Voice</div><div className="detail-value">{selectedVoiceover?.name || 'Avatar Default'}</div></div>
              </div>

              {!result && <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>{loading ? 'Generating...' : 'Generate Video'}</button>}

              {result && (
                <div className="ai-result">
                  <div className="ai-result-header"><span>✅</span><span>Video Generation Started!</span></div>
                  <div className="ai-output-container">
                    <div className="ai-output-section">
                      <div className="ai-output-title">Video Details</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div className="detail-item"><div className="detail-label">Video ID</div><div className="detail-value">#{result.video?.id}</div></div>
                        <div className="detail-item"><div className="detail-label">Script ID</div><div className="detail-value">#{result.script?.id}</div></div>
                        <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><span className="badge badge-warning">{result.video?.status}</span></div></div>
                        <div className="detail-item"><div className="detail-label">Tokens</div><div className="detail-value">{result.aiUsage?.total_tokens || 'N/A'}</div></div>
                      </div>
                    </div>
                    <div className="ai-output-section">
                      <div className="ai-output-title">Generated Script</div>
                      <div className="ai-output-content" style={{ whiteSpace: 'pre-wrap' }}>{result.scriptContent}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#d1fae5', borderRadius: '0.5rem', color: '#065f46' }}>
                    <strong>Saved to Database:</strong> Video record #{result.video?.id} and Script #{result.script?.id} ({result.script?.word_count} words)
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button className="btn btn-secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Previous</button>
            {step < 5 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={
                (step === 1 && !selectedReview) || (step === 2 && !selectedAvatar) || (step === 3 && !selectedTemplate)
              }>Next</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

// AI Tools Page
const AIToolsPage = () => {
  const [selectedTool, setSelectedTool] = useState(null);
  const [formData, setFormData] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  useEffect(() => { api.get('/reviews?limit=100').then(res => setReviews(res.data.data || res.data)); }, []);

  const fetchHistory = async (toolId) => {
    setHistoryLoading(true);
    try {
      const url = toolId ? `/ai-history?tool_id=${toolId}` : '/ai-history';
      const res = await api.get(url);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    setHistoryLoading(false);
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    setSelectedHistoryItem(null);
    if (next) fetchHistory(selectedTool?.id || null);
  };

  const viewHistoryItem = async (item) => {
    if (selectedHistoryItem?.id === item.id) {
      setSelectedHistoryItem(null);
      return;
    }
    try {
      const res = await api.get(`/ai-history/${item.id}`);
      setSelectedHistoryItem(res.data);
    } catch (err) {
      console.error('Failed to load history detail:', err);
    }
  };

  const deleteHistoryItem = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai-history/${id}`);
      setHistory(history.filter(h => h.id !== id));
      if (selectedHistoryItem?.id === id) setSelectedHistoryItem(null);
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const tools = [
    { id: 'generate-script', title: 'Generate Script', description: 'Create video script from review', icon: '📝', color: '#10b981', bg: '#d1fae5' },
    { id: 'enhance-review', title: 'Enhance Review', description: 'Polish and improve review text', icon: '✨', color: '#8b5cf6', bg: '#ede9fe' },
    { id: 'suggest-avatar', title: 'Suggest Avatar', description: 'Get AI avatar recommendations', icon: '🤖', color: '#ec4899', bg: '#fce7f3' },
    { id: 'analyze-sentiment', title: 'Analyze Sentiment', description: 'Deep sentiment analysis', icon: '📊', color: '#f59e0b', bg: '#fef3c7' },
    { id: 'generate-metadata', title: 'Generate Metadata', description: 'Titles, descriptions, hashtags', icon: '🏷️', color: '#06b6d4', bg: '#cffafe' },
    { id: 'generate-cta', title: 'Generate CTA', description: 'Create calls-to-action', icon: '🎯', color: '#ef4444', bg: '#fee2e2' },
    { id: 'translate', title: 'Translate', description: 'Translate to other languages', icon: '🌍', color: '#3b82f6', bg: '#dbeafe' },
    { id: 'suggest-template', title: 'Suggest Template', description: 'Video template recommendations', icon: '🎨', color: '#667eea', bg: '#e0e7ff' },
    { id: 'generate-package', title: 'Complete Package', description: 'Generate everything at once', icon: '📦', color: '#059669', bg: '#d1fae5' },
    { id: 'generate-variations', title: 'A/B Variations', description: 'Create test variations', icon: '🔀', color: '#7c3aed', bg: '#ede9fe' },
    { id: 'generate-interview-questions', title: 'Interview Questions', description: 'Generate testimonial questions', icon: '❓', color: '#dc2626', bg: '#fee2e2' },
    { id: 'analyze-sports-highlights', title: 'Sports Highlights', description: 'Analyze sports footage', icon: '🏆', color: '#16a34a', bg: '#dcfce7' },
    { id: 'analyze-highlights', title: 'Video Highlights', description: 'Find key moments', icon: '✂️', color: '#2563eb', bg: '#dbeafe' },
    { id: 'suggest-broll', title: 'B-Roll Suggester', description: 'Get B-roll recommendations', icon: '🎞️', color: '#9333ea', bg: '#f3e8ff' },
    { id: 'suggest-music', title: 'Music Matcher', description: 'Find perfect background music', icon: '🎵', color: '#ea580c', bg: '#ffedd5' },
    { id: 'generate-transcript', title: 'Transcript Generator', description: 'Generate video transcripts', icon: '📄', color: '#0d9488', bg: '#ccfbf1' },
    { id: 'analyze-quality', title: 'Quality Score', description: 'Score testimonial across quality dimensions', icon: '⭐', color: '#facc15', bg: '#fef9c3' },
    { id: 'analyze-emotion', title: 'Emotion Analysis', description: 'Per-segment emotional tone of a transcript', icon: '💗', color: '#f43f5e', bg: '#ffe4e6' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post(`/ai/${selectedTool.id}`, formData);
      setResult(res.data.result);
      if (showHistory) fetchHistory(selectedTool?.id || null);
    } catch (err) {
      setResult({ error: 'Failed to generate. Check your API key.' });
    }
    setLoading(false);
  };

  const getFormFields = () => {
    const baseFields = {
      'generate-script': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'customer_name', label: 'Customer Name', required: true }, { key: 'company', label: 'Company' }, { key: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'enthusiastic', 'formal'] }],
      'enhance-review': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'enhancement_type', label: 'Enhancement Type', type: 'select', options: ['polish', 'expand', 'condense', 'professional'] }],
      'suggest-avatar': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'customer_name', label: 'Customer Name' }, { key: 'company', label: 'Company' }, { key: 'industry', label: 'Industry' }],
      'analyze-sentiment': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }],
      'generate-metadata': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'customer_name', label: 'Customer Name' }, { key: 'company', label: 'Company' }, { key: 'platform', label: 'Platform', type: 'select', options: ['general', 'youtube', 'linkedin', 'twitter', 'instagram'] }],
      'generate-cta': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'product_service', label: 'Product/Service', required: true }, { key: 'target_action', label: 'Target Action', type: 'select', options: ['Sign up', 'Learn more', 'Contact us', 'Start trial', 'Get quote'] }],
      'translate': [{ key: 'text', label: 'Text to Translate', type: 'textarea', required: true }, { key: 'target_language', label: 'Target Language', type: 'select', options: ['Spanish', 'French', 'German', 'Japanese', 'Mandarin', 'Portuguese', 'Italian', 'Korean'], required: true }],
      'suggest-template': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'industry', label: 'Industry' }, { key: 'brand_colors', label: 'Brand Colors' }, { key: 'duration_preference', label: 'Duration', type: 'select', options: ['30 seconds', '45 seconds', '60 seconds', '90 seconds'] }],
      'generate-package': [{ key: 'review_text', label: 'Review Text', type: 'textarea', required: true }, { key: 'customer_name', label: 'Customer Name', required: true }, { key: 'company', label: 'Company' }],
      'generate-variations': [{ key: 'script', label: 'Original Script', type: 'textarea', required: true }, { key: 'variation_count', label: 'Number of Variations', type: 'select', options: ['2', '3', '4', '5'] }],
      'generate-interview-questions': [{ key: 'topic', label: 'Topic', required: true }, { key: 'industry', label: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Nonprofit', 'SaaS', 'General'] }, { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Medium', 'Hard'] }, { key: 'question_count', label: 'Number of Questions', type: 'select', options: ['3', '5', '7', '10'] }, { key: 'context', label: 'Additional Context', type: 'textarea' }],
      'analyze-sports-highlights': [{ key: 'video_description', label: 'Video Description', type: 'textarea', required: true }, { key: 'sport_type', label: 'Sport Type', type: 'select', options: ['Soccer', 'Basketball', 'Baseball', 'Football', 'Hockey', 'Tennis', 'Golf', 'Boxing', 'MMA', 'Track & Field'], required: true }, { key: 'duration', label: 'Video Duration' }, { key: 'context', label: 'Additional Context', type: 'textarea' }],
      'analyze-highlights': [{ key: 'content_description', label: 'Content Description', type: 'textarea', required: true }, { key: 'content_type', label: 'Content Type', type: 'select', options: ['Conference', 'Webinar', 'Interview', 'Podcast', 'Training', 'Documentary', 'Presentation', 'Meeting'], required: true }, { key: 'duration', label: 'Video Duration' }, { key: 'purpose', label: 'Purpose', type: 'textarea' }],
      'suggest-broll': [{ key: 'context', label: 'Video Context', type: 'textarea', required: true }, { key: 'industry', label: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance', 'Creative', 'Manufacturing', 'Retail', 'Education', 'Hospitality', 'Nonprofit', 'SaaS'], required: true }, { key: 'mood', label: 'Mood', type: 'select', options: ['Energetic', 'Calm', 'Professional', 'Dynamic', 'Inspiring', 'Luxurious', 'Heartfelt'] }, { key: 'duration', label: 'Video Duration' }, { key: 'brand_guidelines', label: 'Brand Guidelines', type: 'textarea' }],
      'suggest-music': [{ key: 'content_description', label: 'Content Description', type: 'textarea', required: true }, { key: 'mood', label: 'Desired Mood', type: 'select', options: ['Inspiring', 'Energetic', 'Calm', 'Emotional', 'Professional', 'Playful', 'Luxurious', 'Motivating'], required: true }, { key: 'duration', label: 'Video Duration' }, { key: 'genre_preference', label: 'Genre Preference', type: 'select', options: ['No preference', 'Corporate', 'Electronic', 'Cinematic', 'Pop', 'Acoustic', 'Classical', 'Jazz'] }, { key: 'energy_level', label: 'Energy Level', type: 'select', options: ['Low', 'Medium', 'High'] }],
      'generate-transcript': [{ key: 'audio_description', label: 'Audio/Video Description', type: 'textarea', required: true }, { key: 'context', label: 'Context', type: 'textarea' }, { key: 'speakers', label: 'Number of Speakers', type: 'select', options: ['1', '2', '3', '4', '5+'] }, { key: 'language', label: 'Language', type: 'select', options: ['English', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin'] }],
      'analyze-quality': [{ key: 'testimonial_text', label: 'Testimonial Text', type: 'textarea', required: true }, { key: 'format', label: 'Format', type: 'select', options: ['video', 'audio', 'written'] }, { key: 'target_use', label: 'Target Use', type: 'select', options: ['marketing website', 'social media', 'sales deck', 'email campaign', 'paid ads'] }],
      'analyze-emotion': [{ key: 'transcript', label: 'Transcript', type: 'textarea', required: true }, { key: 'segment_size', label: 'Segment Size', type: 'select', options: ['sentence', 'paragraph', 'phrase'] }, { key: 'context', label: 'Context', type: 'textarea' }],
    };
    return baseFields[selectedTool?.id] || [];
  };

  const populateFromReview = (reviewId) => {
    const review = reviews.find(r => r.id === parseInt(reviewId));
    if (review) setFormData({ ...formData, review_text: review.review_text, text: review.review_text, customer_name: review.customer_name, company: review.company });
  };

  const sampleData = {
    'generate-script': { review_text: 'This software completely transformed how we manage our customer relationships. Within just 3 months, our team saw a 40% increase in customer retention. The AI-powered insights helped us identify at-risk accounts before they churned. Absolutely game-changing for our business!', customer_name: 'Sarah Mitchell', company: 'CloudScale Solutions', tone: 'professional' },
    'enhance-review': { review_text: 'Great product, really helped our team work better. We like the dashboards and the reports are good too. Would recommend to others.', enhancement_type: 'expand' },
    'suggest-avatar': { review_text: 'As a healthcare administrator, I found this platform invaluable for streamlining patient feedback collection. The HIPAA-compliant features gave us peace of mind while modernizing our approach.', customer_name: 'Dr. James Chen', company: 'MedVista Health', industry: 'Healthcare' },
    'analyze-sentiment': { review_text: 'While the onboarding was a bit slow initially, once we got going the results were phenomenal. Our marketing team loves the automation features, though we wish the reporting was more customizable. Overall a solid 8/10 experience.' },
    'generate-metadata': { review_text: 'Switching to this platform was the best decision we made this year. Our e-commerce conversion rates jumped 25% after implementing the AI-powered product recommendations. The ROI speaks for itself!', customer_name: 'Alex Rivera', company: 'ShopStream Inc', platform: 'youtube' },
    'generate-cta': { review_text: 'The project management features saved our team over 15 hours per week. We went from constant miscommunication to seamless collaboration across 3 time zones.', product_service: 'AI Project Management Suite', target_action: 'Start trial' },
    'translate': { text: 'Our company has been using this incredible platform for over a year now. The customer support is outstanding, and the product keeps getting better with each update. We have seen a 35% improvement in team productivity since adopting it.', target_language: 'Spanish' },
    'suggest-template': { review_text: 'As a fintech startup, we needed a professional and trustworthy way to showcase our client testimonials. This tool delivered exactly that with polished, branded video content that builds credibility.', industry: 'Finance', brand_colors: '#1a365d, #3182ce, #ffffff', duration_preference: '60 seconds' },
    'generate-package': { review_text: 'This CRM platform revolutionized our sales pipeline. We closed 50% more deals in Q4 after implementing the AI lead scoring. The integration with our existing tools was seamless.', customer_name: 'Marcus Thompson', company: 'Apex Ventures' },
    'generate-variations': { script: 'Meet Sarah from CloudScale Solutions. In just 3 months, her team achieved a 40% increase in customer retention using our AI-powered platform. The intelligent insights helped them identify at-risk accounts before they churned. Ready to transform your customer relationships? Start your free trial today.', variation_count: '3' },
    'generate-interview-questions': { topic: 'Customer Success with SaaS Products', industry: 'Technology', difficulty: 'Medium', question_count: '5', context: 'Interviewing a VP of Operations at a mid-size tech company who has been using our platform for 18 months and achieved significant ROI improvements.' },
    'analyze-sports-highlights': { video_description: 'Championship basketball game between the Lakers and Celtics. Fourth quarter with 5 minutes remaining, score tied at 98-98. LeBron drives to the basket, spins past two defenders, and throws down a thunderous dunk. The crowd erupts. Next possession, Tatum responds with a deep three-pointer from the corner. Multiple fast breaks and defensive stops follow.', sport_type: 'Basketball', duration: '12 minutes', context: 'NBA Finals Game 7 highlights reel for social media, targeting 60-second clips with maximum engagement potential.' },
    'analyze-highlights': { content_description: 'Annual tech conference keynote presentation by the CEO. Covers new product launches including an AI assistant, a redesigned mobile app, and enterprise security features. Includes live demos, customer success stories, audience Q&A about pricing and availability, and a surprise partnership announcement with a major cloud provider.', content_type: 'Conference', duration: '45 minutes', purpose: 'Extract the most shareable and newsworthy moments for social media clips and press coverage.' },
    'suggest-broll': { context: 'Creating a customer testimonial video for a healthcare SaaS company. The customer is a hospital administrator discussing how the software improved patient scheduling efficiency by 60% and reduced wait times. The video will be used on the company website and LinkedIn.', industry: 'Healthcare', mood: 'Professional', duration: '90 seconds', brand_guidelines: 'Clean, modern aesthetic. Primary colors: deep blue (#1e3a5f) and white. Avoid stock footage that looks overly staged. Prefer real hospital/clinic environments.' },
    'suggest-music': { content_description: 'A 60-second customer success story video featuring a startup founder explaining how our platform helped them scale from 10 to 500 employees. The tone is optimistic and forward-looking, with a mix of talking-head interview and office/team footage.', mood: 'Inspiring', duration: '60 seconds', genre_preference: 'Corporate', energy_level: 'Medium' },
    'generate-transcript': { audio_description: 'A podcast interview between a host and a SaaS company CEO discussing the future of AI in customer service. They cover topics including chatbot implementation, human-AI collaboration, customer satisfaction metrics, and predictions for the next 5 years. The conversation is casual but informative with some technical jargon.', context: 'Episode 47 of the "Tech Forward" podcast, recorded in a professional studio. This episode focuses on practical AI applications in customer-facing businesses.', speakers: '2', language: 'English' },
    'analyze-quality': { testimonial_text: 'Honestly, I was skeptical when our team picked this platform, but six months in our customer churn dropped 22% and our support response time fell from 8 hours to under 1 hour. The dashboards are clear and the onboarding actually worked.', format: 'video', target_use: 'marketing website' },
    'analyze-emotion': { transcript: 'When we first started, I was overwhelmed. Honestly, I was scared we would not make payroll. Then we adopted this platform and within weeks I felt this huge weight lift. Now I am genuinely excited about where the company is heading. We are hiring again, and the team has never been more energized.', segment_size: 'sentence', context: 'Founder testimonial about turning the business around.' },
  };

  const loadSampleData = () => {
    if (selectedTool && sampleData[selectedTool.id]) {
      setFormData(sampleData[selectedTool.id]);
    }
  };

  const HistoryPanel = () => (
    <div className="history-panel">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Generation History {selectedTool ? `- ${selectedTool.title}` : '- All Tools'}</h3>
        </div>
        <div style={{ padding: '1rem' }}>
          {historyLoading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : history.length === 0 ? (
            <div className="history-empty">No AI generations yet. Use any tool above to get started.</div>
          ) : (
            history.map((item) => (
              <div key={item.id}>
                <div className={`history-item${selectedHistoryItem?.id === item.id ? ' active' : ''}`} onClick={() => viewHistoryItem(item)}>
                  <div className="history-item-header">
                    <span className="history-item-tool">{item.tool_name}</span>
                    <span className="history-item-time">{new Date(item.generated_at).toLocaleString()}</span>
                  </div>
                  <div className="history-item-summary">{item.input_summary || 'No input summary'}</div>
                  <div className="history-item-footer">
                    <div className="history-item-meta">
                      {item.model && <span>{item.model}</span>}
                      {item.total_tokens && <span>{item.total_tokens} tokens</span>}
                    </div>
                    <button className="history-delete-btn" onClick={(e) => deleteHistoryItem(e, item.id)}>Delete</button>
                  </div>
                </div>
                {selectedHistoryItem?.id === item.id && selectedHistoryItem.output_data && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <AIResultDisplay result={typeof selectedHistoryItem.output_data === 'string' ? JSON.parse(selectedHistoryItem.output_data) : selectedHistoryItem.output_data} loading={false} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Tools</h1>
        <button className={`btn btn-history${showHistory ? ' active' : ''}`} onClick={toggleHistory}>
          {showHistory ? 'Hide History' : 'History'}
        </button>
      </div>
      {!selectedTool ? (
        <>
          <div className="ai-tools-grid">
            {tools.map((tool) => (
              <div key={tool.id} className="ai-tool-card" onClick={() => { setSelectedTool(tool); setFormData({}); setResult(null); setSelectedHistoryItem(null); if (showHistory) fetchHistory(tool.id); }}>
                <div className="ai-tool-icon" style={{ background: tool.bg, color: tool.color }}>{tool.icon}</div>
                <div className="ai-tool-title">{tool.title}</div>
                <div className="ai-tool-description">{tool.description}</div>
              </div>
            ))}
          </div>
          {showHistory && <HistoryPanel />}
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={() => { setSelectedTool(null); setSelectedHistoryItem(null); if (showHistory) fetchHistory(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back to Tools
            </button>
            <button className="btn sample-data-btn" onClick={loadSampleData}>Load Sample Data</button>
          </div>
          <div className="card">
            <div className="card-header"><h3 className="card-title">{selectedTool.icon} {selectedTool.title}</h3></div>
            <div style={{ padding: '1.5rem' }}>
              {['generate-script', 'enhance-review', 'suggest-avatar', 'analyze-sentiment', 'generate-metadata', 'generate-cta', 'suggest-template', 'generate-package'].includes(selectedTool.id) && (
                <div className="form-group">
                  <label className="form-label">Quick Fill from Review</label>
                  <select className="select" onChange={(e) => populateFromReview(e.target.value)}><option value="">Select a review...</option>{reviews.map((r) => <option key={r.id} value={r.id}>{r.customer_name} - {r.company}</option>)}</select>
                </div>
              )}
              <form onSubmit={handleSubmit}>
                {getFormFields().map((field) => (
                  <div key={field.key} className="form-group">
                    <label className="form-label">{field.label}</label>
                    {field.type === 'textarea' ? <textarea className="textarea" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required} /> :
                     field.type === 'select' ? <select className="select" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required}><option value="">Select...</option>{field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> :
                     <input type={field.type || 'text'} className="form-input" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required} />}
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Generating...' : 'Generate with AI'}</button>
              </form>
              <AIResultDisplay result={result} loading={loading} />
            </div>
          </div>
          {showHistory && <HistoryPanel />}
        </div>
      )}
    </div>
  );
};

// Analytics Page
const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/overview').then(res => { setAnalytics(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const colors = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const getMaxCount = (data) => Math.max(...data.map(d => parseInt(d.count) || 0), 1);

  return (
    <div>
      <div className="page-header"><h1 className="page-title">📈 Analytics</h1></div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Videos by Status</h3></div>
          <div className="chart-container">
            {analytics?.videosByStatus?.map((item, i) => (
              <div key={item.status} className="chart-bar">
                <div className="chart-bar-label">{item.status}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.count / getMaxCount(analytics.videosByStatus)) * 100}%`, background: colors[i % colors.length] }}>{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Reviews by Rating</h3></div>
          <div className="chart-container">
            {analytics?.reviewsByRating?.map((item) => (
              <div key={item.rating} className="chart-bar">
                <div className="chart-bar-label">{'★'.repeat(item.rating)}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.count / getMaxCount(analytics.reviewsByRating)) * 100}%`, background: '#f59e0b' }}>{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Reviews by Source</h3></div>
          <div className="chart-container">
            {analytics?.reviewsBySource?.slice(0, 6).map((item, i) => (
              <div key={item.source} className="chart-bar">
                <div className="chart-bar-label" style={{ fontSize: '0.75rem' }}>{item.source?.substring(0, 12)}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.count / getMaxCount(analytics.reviewsBySource)) * 100}%`, background: colors[i % colors.length] }}>{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Top Avatar Usage</h3></div>
          <div className="chart-container">
            {analytics?.avatarUsage?.slice(0, 5).map((item, i) => (
              <div key={item.name} className="chart-bar">
                <div className="chart-bar-label" style={{ fontSize: '0.75rem' }}>{item.name?.substring(0, 12)}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.video_count / Math.max(...analytics.avatarUsage.map(a => a.video_count), 1)) * 100}%`, background: colors[i % colors.length] }}>{item.video_count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Top Companies</h3></div>
          <div className="chart-container">
            {analytics?.topCompanies?.slice(0, 5).map((item, i) => (
              <div key={item.company} className="chart-bar">
                <div className="chart-bar-label" style={{ fontSize: '0.75rem' }}>{item.company?.substring(0, 12)}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.review_count / getMaxCount(analytics.topCompanies.map(c => ({ count: c.review_count })))) * 100}%`, background: colors[i % colors.length] }}>
                    {item.review_count} ({parseFloat(item.avg_rating).toFixed(1)}★)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Template Usage</h3></div>
          <div className="chart-container">
            {analytics?.templateUsage?.slice(0, 5).map((item, i) => (
              <div key={item.name} className="chart-bar">
                <div className="chart-bar-label" style={{ fontSize: '0.75rem' }}>{item.name?.substring(0, 12)}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${(item.video_count / Math.max(...analytics.templateUsage.map(t => t.video_count), 1)) * 100}%`, background: colors[i % colors.length] }}>{item.video_count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const [user, setUser] = useState({ name: '', email: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [tab, setTab] = useState('profile');
  const toast = useToast();

  useEffect(() => {
    api.get('/settings').then(res => setUser(res.data)).catch(() => {});
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', user);
      toast?.showToast('Profile updated successfully!', 'success');
    } catch (err) {
      toast?.showToast('Error updating profile', 'error');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast?.showToast('New passwords do not match', 'warning');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast?.showToast('Password must be at least 6 characters', 'warning');
      return;
    }
    try {
      await api.put('/settings/password', passwords);
      toast?.showToast('Password updated successfully!', 'success');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast?.showToast(err.response?.data?.error || 'Error updating password', 'error');
    }
  };

  const handleExportJSON = async (type) => {
    try {
      const res = await api.get(`/export/${type}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.json`;
      a.click();
      toast?.showToast(`Exported ${type} as JSON`, 'success');
    } catch (err) {
      toast?.showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = async (type) => {
    try {
      const res = await api.get(`/export/${type}/csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.csv`;
      a.click();
      toast?.showToast(`Exported ${type} as CSV`, 'success');
    } catch (err) {
      toast?.showToast('CSV export failed', 'error');
    }
  };

  const handleExportPDF = (type) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${type} Export</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#333}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:bold}tr:nth-child(even){background:#fafafa}</style></head><body><h1>${type.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())} Export</h1><p>Generated: ${new Date().toLocaleString()}</p><div id="content">Loading...</div>`);
    api.get(`/export/${type}`).then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      if (data.length === 0) { printWindow.document.getElementById('content').innerHTML = '<p>No data</p>'; return; }
      const keys = Object.keys(data[0]).filter(k => k !== 'password_hash');
      let html = '<table><thead><tr>' + keys.map(k => `<th>${k.replace(/_/g,' ')}</th>`).join('') + '</tr></thead><tbody>';
      data.forEach(row => { html += '<tr>' + keys.map(k => { let v = row[k]; if (v && typeof v === 'object') v = JSON.stringify(v).substring(0,80); return `<td>${v ?? '-'}</td>`; }).join('') + '</tr>'; });
      html += '</tbody></table>';
      printWindow.document.getElementById('content').innerHTML = html;
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    });
    toast?.showToast(`Generating PDF for ${type}`, 'info');
  };

  const exportTypes = ['reviews', 'avatars', 'templates', 'scripts', 'voiceovers', 'videos', 'interview_questions', 'sports_highlights', 'highlights', 'broll_suggestions', 'music_matches', 'transcripts'];

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>

      <div className="tabs">
        <div className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile</div>
        <div className={`tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>Security</div>
        <div className={`tab ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>Export Data</div>
        <div className={`tab ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>API Keys</div>
      </div>

      {tab === 'profile' && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input type="text" className="form-input" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={user.email || ''} onChange={(e) => setUser({ ...user, email: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={handlePasswordUpdate}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary">Update Password</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Export Your Data</h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Choose a data type and export format.</p>
            {exportTypes.map((type) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ fontWeight: 600, flex: 1, minWidth: '120px' }}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExportJSON(type)}>JSON</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExportCSV(type)}>CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExportPDF(type)}>PDF</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>API Configuration</h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>API keys are configured in your .env file on the server.</p>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">OpenRouter</div><div className="detail-value">anthropic/claude-haiku-4.5</div></div>
              <div className="detail-item"><div className="detail-label">HeyGen</div><div className="detail-value">Configured in .env</div></div>
              <div className="detail-item"><div className="detail-label">D-ID</div><div className="detail-value">Configured in .env</div></div>
              <div className="detail-item"><div className="detail-label">Synthesia</div><div className="detail-value">Configured in .env</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Provider Render Page — surfaces /api/avatars/{provider}/generate + status endpoints
const ProviderRenderPage = () => {
  const [provider, setProvider] = useState('heygen');
  const [scripts, setScripts] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [voiceovers, setVoiceovers] = useState([]);
  const [scriptId, setScriptId] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [background, setBackground] = useState('');
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/scripts?limit=100'),
      api.get('/avatars?limit=100'),
      api.get('/voiceovers?limit=100')
    ]).then(([s, a, v]) => {
      setScripts(s.data.data || s.data);
      setAvatars(a.data.data || a.data);
      setVoiceovers(v.data.data || v.data);
    }).catch(() => {});
  }, []);

  const filteredAvatars = avatars.filter(a =>
    a.provider && a.provider.toLowerCase().includes(provider === 'did' ? 'd-id' : provider)
  );

  const handleGenerate = async () => {
    setLoading(true);
    setJob(null);
    setStatus(null);
    try {
      const payload = {
        script: scriptText || (scripts.find(s => String(s.id) === String(scriptId))?.content) || '',
        avatar_id: avatarId,
        voice_id: voiceId
      };
      if (provider === 'did') payload.source_url = sourceUrl;
      if (provider === 'synthesia') payload.background = background;

      const res = await api.post(`/avatars/${provider}/generate`, payload);
      setJob(res.data);
      setHistory(prev => [{ ...res.data, ts: new Date().toISOString() }, ...prev].slice(0, 10));
      toast?.showToast(`${res.data.provider || provider} job started!`, 'success');
    } catch (err) {
      toast?.showToast(err.response?.data?.error || 'Generation failed', 'error');
    }
    setLoading(false);
  };

  const handleCheckStatus = async (jobId) => {
    setStatusLoading(true);
    try {
      const res = await api.get(`/avatars/${provider}/status/${jobId}`);
      setStatus(res.data);
    } catch (err) {
      toast?.showToast('Status check failed', 'error');
    }
    setStatusLoading(false);
  };

  const providers = [
    { id: 'heygen', label: 'HeyGen', desc: '2–5 minute video rendering with realistic talking avatars', color: '#3b82f6' },
    { id: 'did', label: 'D-ID', desc: '1–3 minute photo-to-video animation', color: '#10b981' },
    { id: 'synthesia', label: 'Synthesia', desc: '3–8 minute studio-quality avatar videos', color: '#f59e0b' }
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🎥 Provider Render</h1>
      </div>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Trigger video rendering jobs against HeyGen, D-ID, or Synthesia and poll their status.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>1. Select Provider</h3>
          <div className="selection-grid">
            {providers.map(p => (
              <div
                key={p.id}
                className={`selection-card ${provider === p.id ? 'selected' : ''}`}
                onClick={() => setProvider(p.id)}
                style={{ borderColor: provider === p.id ? p.color : undefined }}
              >
                <div className="selection-card-title">{p.label}</div>
                <div className="selection-card-subtitle">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>2. Configure Job</h3>
          <div className="form-group">
            <label className="form-label">Script (pick existing or paste below)</label>
            <select className="select" value={scriptId} onChange={(e) => {
              setScriptId(e.target.value);
              const s = scripts.find(ss => String(ss.id) === e.target.value);
              if (s) setScriptText(s.content || '');
            }}>
              <option value="">— Select a saved script —</option>
              {scripts.map(s => <option key={s.id} value={s.id}>#{s.id} {(s.content || '').substring(0, 60)}…</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Script Content</label>
            <textarea className="form-input" rows={4} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="Paste or edit the script…" />
          </div>
          <div className="form-group">
            <label className="form-label">Avatar (provider-specific ID)</label>
            <select className="select" value={avatarId} onChange={(e) => setAvatarId(e.target.value)}>
              <option value="">— Select an avatar —</option>
              {filteredAvatars.map(a => <option key={a.id} value={a.avatar_id || a.id}>{a.name} ({a.provider})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Voice (optional)</label>
            <select className="select" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
              <option value="">— Default —</option>
              {voiceovers.map(v => <option key={v.id} value={v.voice_id || v.id}>{v.name} ({v.provider} · {v.language})</option>)}
            </select>
          </div>
          {provider === 'did' && (
            <div className="form-group">
              <label className="form-label">Source Image URL (D-ID requires)</label>
              <input className="form-input" type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {provider === 'synthesia' && (
            <div className="form-group">
              <label className="form-label">Background</label>
              <input className="form-input" type="text" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g., office, studio, custom URL" />
            </div>
          )}
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !scriptText}>
            {loading ? 'Submitting…' : `Render with ${providers.find(p => p.id === provider)?.label}`}
          </button>
        </div>
      </div>

      {job && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>3. Job Result</h3>
            <div className="detail-grid" style={{ marginBottom: '1rem' }}>
              <div className="detail-item"><div className="detail-label">Provider</div><div className="detail-value">{job.provider}</div></div>
              <div className="detail-item"><div className="detail-label">Job ID</div><div className="detail-value"><code>{job.job_id}</code></div></div>
              <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><span className="badge badge-warning">{job.status}</span></div></div>
              <div className="detail-item"><div className="detail-label">ETA</div><div className="detail-value">{job.estimated_time}</div></div>
            </div>
            <button className="btn btn-secondary" onClick={() => handleCheckStatus(job.job_id)} disabled={statusLoading}>
              {statusLoading ? 'Checking…' : 'Check Status'}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Status</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><span className={`badge badge-${status.status === 'completed' ? 'success' : 'warning'}`}>{status.status}</span></div></div>
              <div className="detail-item"><div className="detail-label">Duration</div><div className="detail-value">{status.duration ? `${status.duration}s` : '—'}</div></div>
              <div className="detail-item"><div className="detail-label">Created</div><div className="detail-value">{status.created_at ? new Date(status.created_at).toLocaleString() : '—'}</div></div>
            </div>
            {status.video_url && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Video URL:</strong>{' '}
                <a href={status.video_url} target="_blank" rel="noreferrer">{status.video_url}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Recent Jobs (this session)</h3>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Provider</th>
                  <th>Job ID</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td>{new Date(h.ts).toLocaleTimeString()}</td>
                    <td>{h.provider}</td>
                    <td><code>{h.job_id}</code></td>
                    <td><span className="badge badge-warning">{h.status}</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => handleCheckStatus(h.job_id)}>Status</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Layout
const AppLayout = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />;
      case 'reviews': return <ReviewsPage />;
      case 'avatars': return <AvatarsPage />;
      case 'templates': return <TemplatesPage />;
      case 'scripts': return <ScriptsPage />;
      case 'voiceovers': return <VoiceoversPage />;
      case 'videos': return <VideosPage />;
      case 'create-video': return <CreateVideoPage />;
      case 'ai-tools': return <AIToolsPage />;
      case 'provider-render': return <ProviderRenderPage />;
      case 'interview-questions': return <InterviewQuestionsPage />;
      case 'sports-highlights': return <SportsHighlightsPage />;
      case 'highlights': return <HighlightsPage />;
      case 'broll-suggestions': return <BRollSuggestionsPage />;
      case 'music-matches': return <MusicMatchesPage />;
      case 'transcripts': return <TranscriptsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="layout">
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1040 }} onClick={() => setSidebarOpen(false)} />}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>;
};

// Main App
const App = () => (
  <ErrorBoundary>
    <style>{styles}</style>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          {/* // === Batch 08 Gaps & Frontend Mounts === */}
      <Route path="/cf-testimonial-quality-scorer-emotional-impact-clarity-length" element={<ProtectedRoute><CfTestimonialQualityScorerEmotionalImpactClarityLength /></ProtectedRoute>} />
      <Route path="/cf-emotional-tone-and-body-language-analysis-for-authenticity-scoring" element={<ProtectedRoute><CfEmotionalToneAndBodyLanguageAnalysisFor /></ProtectedRoute>} />
      <Route path="/cf-auto-editing-assistant-suggesting-cuts-pacing-adjustments-retakes" element={<ProtectedRoute><CfAutoEditingAssistantSuggestingCutsPacingAdjustments /></ProtectedRoute>} />
      <Route path="/cf-transcription-with-emotion-sentiment-markers-timeline-aligned" element={<ProtectedRoute><CfTranscriptionWithEmotionSentimentMarkersTimelineAligned /></ProtectedRoute>} />
      <Route path="/cf-testimonial-campaign-optimizer-recommending-selection-and-ordering" element={<ProtectedRoute><CfTestimonialCampaignOptimizerRecommendingSelectionAndOrdering /></ProtectedRoute>} />
      <Route path="/cf-real-time-recording-coach-giving-feedback-during-capture" element={<ProtectedRoute><CfRealTimeRecordingCoachGivingFeedbackDuring /></ProtectedRoute>} />
      <Route path="/gap-ai-is-actually-substantial-18-endpoints-tsv-claim" element={<ProtectedRoute><GapAiIsActuallySubstantial18EndpointsTsv /></ProtectedRoute>} />
      <Route path="/gap-no-vision-based-body-language-analysis-beyond-emotion" element={<ProtectedRoute><GapNoVisionBasedBodyLanguageAnalysisBeyond /></ProtectedRoute>} />
      <Route path="/gap-no-real-time-recording-coach-during-capture" element={<ProtectedRoute><GapNoRealTimeRecordingCoachDuringCapture /></ProtectedRoute>} />
      <Route path="/gap-no-native-linkedin-tiktok-publishing" element={<ProtectedRoute><GapNoNativeLinkedinTiktokPublishing /></ProtectedRoute>} />
      <Route path="/gap-no-collaboration-commenting-on-draft-testimonials" element={<ProtectedRoute><GapNoCollaborationCommentingOnDraftTestimonials /></ProtectedRoute>} />
      <Route path="/gap-limited-multi-approver-workflow-single-approvals-route" element={<ProtectedRoute><GapLimitedMultiApproverWorkflowSingleApprovalsRoute /></ProtectedRoute>} />
      <Route path="/gap-no-webhook-notifications-for-approval-state-changes" element={<ProtectedRoute><GapNoWebhookNotificationsForApprovalStateChanges /></ProtectedRoute>} />
      <Route path="/gap-no-multi-tenant-white-label-support" element={<ProtectedRoute><GapNoMultiTenantWhiteLabelSupport /></ProtectedRoute>} />
      <Route path="/custom-views" element={<ProtectedRoute><CustomViewsPage /></ProtectedRoute>} />
      </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
