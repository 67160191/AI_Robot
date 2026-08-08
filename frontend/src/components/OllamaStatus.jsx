// ============================================================
// OllamaStatus Component - แสดงสถานะ Ollama + Models
// ============================================================
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './OllamaStatus.css';

export default function OllamaStatus() {
  const [data, setData] = useState({ health: false, models: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const result = await api.getModels();
      if (result.success) setData(result.data);
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ollama-status glass-card">
      <div className="ollama-header">
        <span className="ollama-icon">🧠</span>
        <div>
          <div className="ollama-title display">Ollama AI</div>
          <div className="ollama-url mono">http://localhost:11434</div>
        </div>
        <div className={`ollama-badge ${data.health ? 'online' : 'offline'}`}>
          <span className={`status-dot ${data.health ? 'running' : 'error'}`}></span>
          {data.health ? 'Online' : 'Offline'}
        </div>
      </div>

      {!loading && data.models.length > 0 && (
        <div className="model-list">
          {data.models.map(m => (
            <div key={m.name} className="model-item">
              <span className="model-name mono">{m.name}</span>
              <span className="model-size">
                {m.size ? `${(m.size / 1e9).toFixed(1)}GB` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !data.health && (
        <div className="ollama-offline-msg">
          ⚠️ Ollama ไม่ตอบสนอง<br/>
          <span className="mono">ollama serve</span>
        </div>
      )}
    </div>
  );
}
