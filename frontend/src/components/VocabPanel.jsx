// ============================================================
// VocabPanel - จัดการคลังคำสั่ง (เพิ่ม / ลบ aliases และ shortcuts)
// ============================================================
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './VocabPanel.css';

const DEVICES = [
  { id: 'conveyor1', label: '🏭 สายพาน 1' },
  { id: 'conveyor2', label: '🏭 สายพาน 2' },
  { id: 'motor1',   label: '⚙️ มอเตอร์หลัก' },
  { id: 'pump1',    label: '💧 ปั๊มน้ำ' },
  { id: 'fan1',     label: '🌀 พัดลม' },
  { id: 'robot1',   label: '🦾 หุ่นยนต์' },
];

const ACTIONS = [
  { id: 'start',         label: '▶ เปิด / เดิน' },
  { id: 'stop',          label: '⏹ หยุด / ปิด' },
  { id: 'set_speed',     label: '⚡ ตั้งความเร็ว' },
  { id: 'emergency_stop',label: '🚨 หยุดฉุกเฉิน' },
  { id: 'reset',         label: '↺ รีเซ็ต' },
];

export default function VocabPanel() {
  const [vocab, setVocab]       = useState({ deviceAliases: {}, actionAliases: {}, customCommands: [] });
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('custom'); // custom | device | action

  // Form states
  const [newPhrase, setNewPhrase]   = useState('');
  const [newDevice, setNewDevice]   = useState('conveyor1');
  const [newAction, setNewAction]   = useState('start');
  const [newSpeed, setNewSpeed]     = useState('');
  const [newNote, setNewNote]       = useState('');
  const [newAlias, setNewAlias]     = useState('');
  const [newAliasTarget, setNewAliasTarget] = useState('conveyor1');
  const [newActionAlias, setNewActionAlias] = useState('');
  const [newActionTarget, setNewActionTarget] = useState('start');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState('');

  const fetchVocab = async () => {
    const result = await api.getVocab();
    if (result.success) setVocab(result.data);
    setLoading(false);
  };

  useEffect(() => { fetchVocab(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── เพิ่ม custom command ──
  const handleAddCommand = async () => {
    if (!newPhrase.trim()) return;
    setSaving(true);
    const params = (newAction === 'set_speed' && newSpeed) ? { speed: parseInt(newSpeed) } : {};
    const result = await api.addCustomCommand({
      phrase: newPhrase, device: newDevice, action: newAction, params, note: newNote
    });
    if (result.success) {
      setNewPhrase(''); setNewNote(''); setNewSpeed('');
      await fetchVocab();
      showToast(`✅ เพิ่มคำสั่ง "${newPhrase}" แล้ว`);
    }
    setSaving(false);
  };

  const handleDeleteCommand = async (id, phrase) => {
    if (!confirm(`ลบ "${phrase}"?`)) return;
    await api.deleteCustomCommand(id);
    await fetchVocab();
    showToast(`🗑️ ลบ "${phrase}" แล้ว`);
  };

  // ── เพิ่ม device alias ──
  const handleAddDeviceAlias = async () => {
    if (!newAlias.trim()) return;
    setSaving(true);
    const result = await api.addDeviceAlias(newAlias, newAliasTarget);
    if (result.success) {
      setNewAlias('');
      await fetchVocab();
      showToast(`✅ เพิ่ม "${newAlias}" → ${newAliasTarget}`);
    }
    setSaving(false);
  };

  const handleDeleteDeviceAlias = async (key) => {
    await api.deleteAlias('device', key);
    await fetchVocab();
    showToast(`🗑️ ลบ "${key}"`);
  };

  // ── เพิ่ม action alias ──
  const handleAddActionAlias = async () => {
    if (!newActionAlias.trim()) return;
    setSaving(true);
    const result = await api.addActionAlias(newActionAlias, newActionTarget);
    if (result.success) {
      setNewActionAlias('');
      await fetchVocab();
      showToast(`✅ เพิ่ม "${newActionAlias}" → ${newActionTarget}`);
    }
    setSaving(false);
  };

  const handleDeleteActionAlias = async (key) => {
    await api.deleteAlias('action', key);
    await fetchVocab();
    showToast(`🗑️ ลบ "${key}"`);
  };

  return (
    <div className="vocab-panel">

      {/* Toast */}
      {toast && <div className="vocab-toast">{toast}</div>}

      {/* Header */}
      <div className="vocab-header glass-card">
        <div>
          <h2 className="vocab-title">📚 คลังคำสั่ง</h2>
          <p className="vocab-desc">เพิ่มคำศัพท์และคำสั่งลัด ให้ AI เข้าใจคำของคุณได้มากขึ้น</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchVocab}>🔄 รีโหลด</button>
      </div>

      {/* Sub Tabs */}
      <div className="vocab-tabs">
        {[
          { id: 'custom', label: '⚡ คำสั่งลัด',    count: vocab.customCommands?.length },
          { id: 'device', label: '🏭 ชื่ออุปกรณ์',  count: Object.keys(vocab.deviceAliases || {}).length },
          { id: 'action', label: '▶ ชื่อ Action',   count: Object.keys(vocab.actionAliases || {}).length },
        ].map(tab => (
          <button
            key={tab.id}
            className={`vocab-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="vocab-tab-count">{tab.count ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="vocab-loading"><div className="spinner" />กำลังโหลด...</div>
      ) : (

        <div className="vocab-content">

          {/* ── Tab: Custom Commands ── */}
          {activeTab === 'custom' && (
            <div className="vocab-section">
              <p className="vocab-hint">
                💡 คำสั่งลัด คือประโยคที่พิมพ์แล้วจะสั่ง device/action โดยตรงโดยไม่ต้องพึ่ง AI
              </p>

              {/* Add form */}
              <div className="vocab-form glass-card">
                <h3 className="vocab-form-title">➕ เพิ่มคำสั่งลัดใหม่</h3>
                <div className="vocab-form-row">
                  <div className="vocab-field">
                    <label>ประโยคที่พิมพ์</label>
                    <input className="vocab-input" value={newPhrase}
                      onChange={e => setNewPhrase(e.target.value)}
                      placeholder="เช่น ทดสอบสายพาน, เดินระบบ..." />
                  </div>
                  <div className="vocab-field">
                    <label>อุปกรณ์</label>
                    <select className="vocab-select" value={newDevice} onChange={e => setNewDevice(e.target.value)}>
                      {DEVICES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="vocab-field">
                    <label>Action</label>
                    <select className="vocab-select" value={newAction} onChange={e => setNewAction(e.target.value)}>
                      {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                  {newAction === 'set_speed' && (
                    <div className="vocab-field vocab-field-sm">
                      <label>Speed %</label>
                      <input className="vocab-input" type="number" min="0" max="100"
                        value={newSpeed} onChange={e => setNewSpeed(e.target.value)}
                        placeholder="0-100" />
                    </div>
                  )}
                  <div className="vocab-field">
                    <label>หมายเหตุ</label>
                    <input className="vocab-input" value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="(optional)" />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddCommand} disabled={!newPhrase.trim() || saving}>
                  {saving ? <div className="spinner" style={{width:14,height:14}} /> : '➕ เพิ่ม'}
                </button>
              </div>

              {/* List */}
              <div className="vocab-list">
                {vocab.customCommands?.length === 0 && (
                  <div className="vocab-empty">ยังไม่มีคำสั่งลัด กด ➕ เพิ่มได้เลย</div>
                )}
                {vocab.customCommands?.map(cmd => (
                  <div key={cmd.id} className="vocab-item glass-card">
                    <div className="vocab-item-left">
                      <span className="vocab-phrase">"{cmd.phrase}"</span>
                      <div className="vocab-item-tags">
                        <span className="tag tag-cyan">{cmd.device}</span>
                        <span className="tag tag-yellow">{cmd.action}</span>
                        {cmd.params?.speed !== undefined && (
                          <span className="tag tag-green">{cmd.params.speed}%</span>
                        )}
                      </div>
                      {cmd.note && <span className="vocab-note">{cmd.note}</span>}
                    </div>
                    <button className="btn-delete" onClick={() => handleDeleteCommand(cmd.id, cmd.phrase)}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Device Aliases ── */}
          {activeTab === 'device' && (
            <div className="vocab-section">
              <p className="vocab-hint">
                💡 ชื่อเรียกอื่น ๆ ของอุปกรณ์ เช่น "ไลน์" → conveyor1
              </p>

              <div className="vocab-form glass-card">
                <h3 className="vocab-form-title">➕ เพิ่มชื่อเรียกอุปกรณ์</h3>
                <div className="vocab-form-row">
                  <div className="vocab-field">
                    <label>ชื่อที่จะพิมพ์</label>
                    <input className="vocab-input" value={newAlias}
                      onChange={e => setNewAlias(e.target.value)}
                      placeholder="เช่น ไลน์, สายส่ง, m1..." />
                  </div>
                  <div className="vocab-field">
                    <label>อุปกรณ์ที่ตรงกัน</label>
                    <select className="vocab-select" value={newAliasTarget} onChange={e => setNewAliasTarget(e.target.value)}>
                      {DEVICES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddDeviceAlias} disabled={!newAlias.trim() || saving}>
                  ➕ เพิ่ม
                </button>
              </div>

              <div className="vocab-list">
                {Object.entries(vocab.deviceAliases || {}).length === 0 && (
                  <div className="vocab-empty">ยังไม่มีชื่อเรียกอื่น</div>
                )}
                {Object.entries(vocab.deviceAliases || {}).map(([alias, deviceId]) => (
                  <div key={alias} className="vocab-item glass-card">
                    <div className="vocab-item-left">
                      <span className="vocab-phrase mono">"{alias}"</span>
                      <span style={{color:'var(--text-muted)'}}>→</span>
                      <span className="tag tag-cyan">{deviceId}</span>
                    </div>
                    <button className="btn-delete" onClick={() => handleDeleteDeviceAlias(alias)}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Action Aliases ── */}
          {activeTab === 'action' && (
            <div className="vocab-section">
              <p className="vocab-hint">
                💡 ชื่อเรียกอื่น ๆ ของ action เช่น "สตาร์ท" → start, "ดับ" → stop
              </p>

              <div className="vocab-form glass-card">
                <h3 className="vocab-form-title">➕ เพิ่มชื่อเรียก Action</h3>
                <div className="vocab-form-row">
                  <div className="vocab-field">
                    <label>คำที่จะพิมพ์</label>
                    <input className="vocab-input" value={newActionAlias}
                      onChange={e => setNewActionAlias(e.target.value)}
                      placeholder="เช่น สตาร์ท, เดิน, ดับ..." />
                  </div>
                  <div className="vocab-field">
                    <label>Action ที่ตรงกัน</label>
                    <select className="vocab-select" value={newActionTarget} onChange={e => setNewActionTarget(e.target.value)}>
                      {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddActionAlias} disabled={!newActionAlias.trim() || saving}>
                  ➕ เพิ่ม
                </button>
              </div>

              <div className="vocab-list">
                {Object.entries(vocab.actionAliases || {}).length === 0 && (
                  <div className="vocab-empty">ยังไม่มีชื่อเรียกอื่น</div>
                )}
                {Object.entries(vocab.actionAliases || {}).map(([alias, action]) => (
                  <div key={alias} className="vocab-item glass-card">
                    <div className="vocab-item-left">
                      <span className="vocab-phrase mono">"{alias}"</span>
                      <span style={{color:'var(--text-muted)'}}>→</span>
                      <span className="tag tag-yellow">{action}</span>
                    </div>
                    <button className="btn-delete" onClick={() => handleDeleteActionAlias(alias)}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
