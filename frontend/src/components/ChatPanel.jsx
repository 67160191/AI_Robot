// ============================================================
// ChatPanel Component - AI Chat Interface (Fixed confirm flow)
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import './ChatPanel.css';

const QUICK_PROMPTS = [
  "เปิดสายพาน 1",
  "หยุดมอเตอร์",
  "เปิดพัดลมระบายความร้อน",
  "ตั้งความเร็วปั๊ม 80%",
  "ทดสอบระบบ",
  "Emergency Stop ทั้งระบบ",
];

export default function ChatPanel({ onCommandResult, selectedModel }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      content: 'สวัสดีครับ ผม AI Operator พร้อมรับคำสั่ง\nพิมพ์คำสั่งภาษาไทยได้เลย เช่น "เปิดสายพาน 1" หรือ "หยุดมอเตอร์"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      ...msg
    }]);
  };

  const updateMessage = (id, updates) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // ── ส่งคำสั่ง → AI parse (ยังไม่ execute) ──
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    addMessage({ role: 'user', content: text });
    setIsLoading(true);

    try {
      const result = await api.sendCommand(text, selectedModel);

      if (!result.success) {
        addMessage({ role: 'ai', content: `❌ เกิดข้อผิดพลาด: ${result.error || 'ไม่ทราบสาเหตุ'}`, isError: true });
        return;
      }

      const data = result.data || {};
      const { id, device, action, params, aiMessage, model, source } = data;
      const safeMessage = aiMessage || (device ? `${action || 'command'} → ${device}` : 'ได้รับคำสั่งแล้ว');

      if (device && action && action !== 'chat') {
        // มีคำสั่งควบคุม → แสดง confirm (ยังไม่ execute)
        addMessage({
          role: 'ai',
          content: safeMessage,
          isPending: true,
          pendingId: id,
          device, action, params: params || {},
          model, source
        });
      } else {
        addMessage({ role: 'ai', content: safeMessage });
      }

      onCommandResult?.(data, false);

    } catch (err) {
      addMessage({ role: 'ai', content: `❌ ${err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`, isError: true });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── กด Confirm → Execute จริง → refresh dashboard ──
  const handleConfirm = async (msgId, { pendingId, device, action, params }) => {
    updateMessage(msgId, { isPending: false, isConfirming: true });

    try {
      const result = await api.executeCommand({ id: pendingId, device, action, params: params || {} });

      if (result.success) {
        const execMsg = result.data?.machineResult?.message || `${action} ${device} สำเร็จ`;
        updateMessage(msgId, { isConfirming: false, isConfirmed: true });
        addMessage({ role: 'ai', content: `✅ ${execMsg}`, isSuccess: true });
        // Refresh dashboard ทันที
        onCommandResult?.({ device, action, params, machineResult: result.data?.machineResult }, true);
      } else {
        updateMessage(msgId, { isConfirming: false, isPending: false });
        addMessage({ role: 'ai', content: `❌ Execute ล้มเหลว: ${result.error || 'ไม่ทราบสาเหตุ'}`, isError: true });
      }
    } catch (err) {
      updateMessage(msgId, { isConfirming: false, isPending: false });
      addMessage({ role: 'ai', content: `❌ เกิดข้อผิดพลาด: ${err.message || 'ไม่ทราบสาเหตุ'}`, isError: true });
    }
  };

  const handleReject = (msgId) => {
    updateMessage(msgId, { isPending: false, isRejected: true });
    addMessage({ role: 'ai', content: '↩️ ยกเลิกคำสั่งแล้วครับ', isWarning: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="chat-panel glass-card">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="ai-avatar">🤖</div>
          <div>
            <h2 className="chat-title display">AI Operator</h2>
            <span className="chat-subtitle mono">
              {selectedModel ? `🤖 ${selectedModel}` : '🤖 Auto Model'}
            </span>
          </div>
        </div>
        <div className="online-badge">
          <span className="status-dot running"></span>
          <span>Online</span>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} className="quick-prompt-btn"
            onClick={() => { setInput(p); inputRef.current?.focus(); }}>
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role} animate-fade-up`}>
            {msg.role === 'ai' && <div className="msg-avatar">🤖</div>}

            <div className="message-bubble-wrap">
              <div className={`message-bubble ${msg.role}
                ${msg.isError ? 'error' : ''}
                ${msg.isSuccess ? 'success' : ''}
                ${msg.isWarning ? 'warning' : ''}`}>

                {(msg.content || '').split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}

                {/* Pending confirm */}
                {msg.isPending && (
                  <div className="confirm-box">
                    <div className="confirm-info">
                      <span className="tag tag-cyan">Device</span>
                      <span className="mono">{msg.device}</span>
                      <span className="tag tag-yellow">Action</span>
                      <span className="mono">{msg.action}</span>
                      {msg.params?.speed !== undefined && (
                        <><span className="tag tag-cyan">Speed</span>
                        <span className="mono">{msg.params.speed}%</span></>
                      )}
                    </div>
                    {msg.source && (
                      <div className="confirm-source">
                        🔍 แหล่งที่มา: <span className="mono">{msg.source}</span>
                        {msg.model && <> · <span className="mono">{msg.model}</span></>}
                      </div>
                    )}
                    <div className="confirm-actions">
                      <button className="btn btn-success btn-sm"
                        onClick={() => handleConfirm(msg.id, msg)}>
                        ✅ ยืนยัน
                      </button>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => handleReject(msg.id)}>
                        ✗ ยกเลิก
                      </button>
                    </div>
                  </div>
                )}

                {msg.isConfirming && (
                  <div className="confirm-box" style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>กำลังส่งคำสั่ง...</span>
                  </div>
                )}

                {msg.isConfirmed  && <div className="confirmed-badge">✅ ดำเนินการแล้ว</div>}
                {msg.isRejected   && <div className="rejected-badge">↩️ ยกเลิก</div>}
              </div>
              <span className="msg-time">{formatTime(msg.timestamp)}</span>
            </div>

            {msg.role === 'user' && <div className="msg-avatar user-avatar">👤</div>}
          </div>
        ))}

        {isLoading && (
          <div className="message-row ai animate-fade-up">
            <div className="msg-avatar">🤖</div>
            <div className="message-bubble ai loading">
              <div className="typing-dots"><span/><span/><span/></div>
              <span className="typing-label">AI กำลังวิเคราะห์คำสั่ง...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์คำสั่งภาษาไทย เช่น 'เปิดสายพาน 1' หรือ 'ตั้งพัดลม 80%' ..."
          rows={2}
          disabled={isLoading}
        />
        <button
          className="send-btn btn btn-primary"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}>
          {isLoading ? <div className="spinner" /> : '▶ ส่ง'}
        </button>
      </div>
    </div>
  );
}
