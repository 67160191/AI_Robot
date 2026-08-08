// ============================================================
// ModelSelector - Dropdown เลือก Ollama Model
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import './ModelSelector.css';

export default function ModelSelector({ selectedModel, onModelChange }) {
  const [models, setModels] = useState([]);
  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchModels = async () => {
    const result = await api.getModels();
    if (result.success) {
      setModels(result.data.models || []);
      setHealth(result.data.health);

      // ถ้ายังไม่ได้เลือก model ให้ auto-select ตัวแรก
      if (!selectedModel && result.data.models?.length > 0) {
        // auto-select ตาม preferred order
        const preferred = ['qwen', 'gemma', 'llama', 'mistral', 'phi'];
        let autoModel = null;
        for (const pref of preferred) {
          const found = result.data.models.find(m => m.name.toLowerCase().includes(pref));
          if (found) { autoModel = found.name; break; }
        }
        if (!autoModel) autoModel = result.data.models[0]?.name;
        if (autoModel) onModelChange(autoModel);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 15000);
    return () => clearInterval(interval);
  }, []);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelName) => {
    onModelChange(modelName);
    setOpen(false);
  };

  const displayName = selectedModel
    ? selectedModel.length > 22 ? selectedModel.slice(0, 20) + '…' : selectedModel
    : 'Auto Detect';

  return (
    <div className="model-selector" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className={`model-trigger ${open ? 'open' : ''} ${health ? 'healthy' : 'unhealthy'}`}
        onClick={() => setOpen(prev => !prev)}
        title="เลือก Ollama Model"
      >
        <span className="model-trigger-icon">🧠</span>
        <div className="model-trigger-text">
          <span className="model-trigger-label">AI Model</span>
          <span className="model-trigger-name mono">{loading ? '...' : displayName}</span>
        </div>
        <div className="model-trigger-right">
          <span className={`health-dot ${health ? 'online' : 'offline'}`}></span>
          <span className="model-chevron">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="model-dropdown">
          <div className="model-dropdown-header">
            <span>🤖 เลือก Model</span>
            <span className={`health-badge ${health ? 'online' : 'offline'}`}>
              Ollama {health ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>

          {/* Auto option */}
          <button
            className={`model-option ${!selectedModel ? 'selected' : ''}`}
            onClick={() => handleSelect(null)}
          >
            <span className="model-opt-icon">🔮</span>
            <div className="model-opt-info">
              <span className="model-opt-name">Auto Detect</span>
              <span className="model-opt-desc">ใช้ model ที่ดีที่สุดอัตโนมัติ</span>
            </div>
            {!selectedModel && <span className="model-check">✓</span>}
          </button>

          <div className="model-divider" />

          {loading ? (
            <div className="model-loading">
              <div className="spinner" style={{ width: 16, height: 16 }} />
              <span>กำลังโหลด models...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="model-empty">
              <span>⚠️ ไม่พบ models ใน Ollama</span>
              <code>ollama pull qwen2.5:3b</code>
            </div>
          ) : (
            models.map(m => {
              const isSelected = selectedModel === m.name;
              const sizeGB = m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '';
              return (
                <button
                  key={m.name}
                  className={`model-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(m.name)}
                >
                  <span className="model-opt-icon">⚡</span>
                  <div className="model-opt-info">
                    <span className="model-opt-name mono">{m.name}</span>
                    {sizeGB && <span className="model-opt-desc">{sizeGB}</span>}
                  </div>
                  {isSelected && <span className="model-check">✓</span>}
                </button>
              );
            })
          )}

          {!health && (
            <div className="model-offline-hint">
              ⚠️ Ollama ไม่ตอบสนอง<br />
              รัน: <code>ollama serve</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
