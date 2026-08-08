// ============================================================
// CommandHistory Component - Log viewer
// ============================================================
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './CommandHistory.css';

const ACTION_ICON = {
  start: '▶',
  on: '▶',
  stop: '⏹',
  off: '⏹',
  set_speed: '⚡',
  emergency_stop: '🚨',
  reset: '↺',
  chat: '💬'
};

export default function CommandHistory({ refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    const result = await api.getHistory(30);
    if (result.success) setHistory(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (refreshTrigger) fetchHistory();
  }, [refreshTrigger]);

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <div className="history-panel glass-card">
      <div className="history-header">
        <h3 className="history-title">📋 ประวัติคำสั่ง</h3>
        <span className="tag tag-cyan">{history.length} รายการ</span>
      </div>

      <div className="history-list">
        {isLoading ? (
          <div className="history-loading">
            <div className="spinner" />
            <span>กำลังโหลด...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <span>ยังไม่มีประวัติคำสั่ง</span>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className={`history-item animate-fade-up ${item.success ? 'success' : 'failed'}`}>
              <div className="history-item-top">
                <span className="action-icon">
                  {ACTION_ICON[item.action] || '❓'}
                </span>
                <span className="history-user-msg">"{item.userMessage}"</span>
                <span className="history-time mono">{formatTime(item.timestamp)}</span>
              </div>
              <div className="history-item-bottom">
                {item.device && (
                  <span className="tag tag-cyan">{item.device}</span>
                )}
                {item.action && item.action !== 'chat' && (
                  <span className="tag tag-yellow">{item.action}</span>
                )}
                <span className={`tag ${item.success ? 'tag-green' : 'tag-red'}`}>
                  {item.success ? '✓ สำเร็จ' : '✗ ล้มเหลว'}
                </span>
                <span className="history-ai-msg">{item.aiMessage}</span>
              </div>
              <div className="history-model mono">
                🤖 {item.model} · {item.mqttMode}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
