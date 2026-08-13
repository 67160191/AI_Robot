// ============================================================
// App.jsx - Main Application Layout (Fixed Header + Model Selector)
// ============================================================
import { useState } from 'react';
import ChatPanel from './components/ChatPanel';
import MachineStatus from './components/MachineStatus';
import CommandHistory from './components/CommandHistory';
import ModelSelector from './components/ModelSelector';
import VocabPanel from './components/VocabPanel';
import GatewayMonitor from './components/GatewayMonitor';
import './App.css';

const TABS = [
  { id: 'dashboard', label: '📊', desc: 'Dashboard' },
  { id: 'history',   label: '📋', desc: 'History'  },
  { id: 'vocab',     label: '📚', desc: 'คลังคำ'  },
];

export default function App() {
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastCommand, setLastCommand]   = useState(null);
  const [selectedModel, setSelectedModel] = useState(null); // null = auto

  const handleCommandResult = (data, confirmed = false) => {
    setLastCommand({ ...data, confirmed });
    if (confirmed || data.action === 'chat') {
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="app-layout">

      {/* ─── Header ─── */}
      <header className="app-header">

        {/* Brand */}
        <div className="header-brand">
          <div className="header-logo display">⚡ AI ROBOT</div>
          <div className="header-tagline">ระบบควบคุมเครื่องจักรด้วย AI</div>
        </div>

        {/* Tabs — ตรงกลาง */}
        <nav className="header-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.label}</span>
              <span className="tab-desc">{tab.desc}</span>
            </button>
          ))}
        </nav>

        {/* Right — Model Selector */}
        <div className="header-right">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>

      </header>

      {/* ─── Main ─── */}
      <main className="app-main">

        {/* Left — Chat */}
        <section className="chat-section">
          <ChatPanel
            onCommandResult={handleCommandResult}
            selectedModel={selectedModel}
          />
        </section>

        {/* Right — Dashboard / History / Vocab */}
        <section className="right-section">
          {activeTab === 'dashboard' && (
            <MachineStatus refreshTrigger={refreshTrigger} onCommandResult={handleCommandResult} />
          )}
          {activeTab === 'history' && (
            <CommandHistory refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'vocab' && (
            <VocabPanel />
          )}
        </section>

      </main>

      {/* ─── Footer ─── */}
      <footer className="app-footer">
        <span className="footer-left mono">
          🤖 AI Robot Operator v1.0 · React + Vite + Node.js + Ollama
        </span>

        {lastCommand && (
          <div className="footer-last-cmd">
            <span className="footer-label">Last:</span>
            <span className="mono">{lastCommand.device || 'chat'}</span>
            <span className="mono">→ {lastCommand.action}</span>
            <span className={`tag ${lastCommand.confirmed ? 'tag-green' : 'tag-gray'}`}>
              {lastCommand.confirmed ? '✓ confirmed' : 'pending'}
            </span>
          </div>
        )}

        <span className="footer-right mono">
          {selectedModel
            ? `🧠 ${selectedModel}`
            : '🧠 Auto Model'}
          {' · '}backend:3001
        </span>
      </footer>

      {/* ─── มุมขวาล่าง: Gateway & PLC Telemetry Monitor ─── */}
      <GatewayMonitor lastCommand={lastCommand} />

    </div>
  );
}
