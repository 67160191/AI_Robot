// ============================================================
// MachineStatus Component - Real-time Dashboard
// ============================================================
import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { api } from '../services/api';
import { playSirenSound } from '../utils/audioFX';
import './MachineStatus.css';

const STATUS_LABEL = {
  running: 'กำลังทำงาน',
  stopped: 'หยุดทำงาน',
  warning: 'คำเตือน',
  error: 'ขัดข้อง'
};

const STATUS_COLOR = {
  running: 'var(--status-running)',
  stopped: 'var(--text-muted)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)'
};



function PlcInfoStrip({ plcInfo }) {
  if (!plcInfo) return null;

  const stationColor = {
    'PLC-01': '#00c896',
    'PLC-02': '#4f9eff',
    'PLC-03': '#ff9f4a'
  }[plcInfo.station] || '#a0a0a0';

  return (
    <div className="plc-info-strip">
      <div className="plc-strip-left">
        <span className="plc-station-badge" style={{ borderColor: stationColor, color: stationColor }}>
          {plcInfo.station}
        </span>
        <span className="plc-brand-chip">{plcInfo.brand}</span>
      </div>
      <div className="plc-strip-right mono">
        <span className="plc-model-text">{plcInfo.model}</span>
        <span className="plc-divider">|</span>
        <span className="plc-ip-text">{plcInfo.ip}</span>
        <span className="plc-divider">|</span>
        <span className="plc-coil-text">Coil {plcInfo.coil} ({plcInfo.bit})</span>
      </div>
    </div>
  );
}

// ─── PLC Summary Card ──────────────────────────────────────
function PlcSummaryCard({ plcData }) {
  const statusColor = {
    online: 'var(--status-running)',
    offline: 'var(--text-muted)',
    error: 'var(--status-error)'
  }[plcData.status] || '#a0a0a0';

  const statusBg = {
    online: 'rgba(0,200,150,0.1)',
    offline: 'rgba(160,160,160,0.1)',
    error: 'rgba(255,80,80,0.1)'
  }[plcData.status] || 'rgba(160,160,160,0.1)';

  const brandIcons = {
    'Mitsubishi': '🔴',
    'Siemens': '🔵',
    'Schneider': '🟢'
  }[plcData.brand] || '🏭';

  return (
    <div
      className="plc-card glass-card"
      style={{
        background: statusBg,
        borderColor: statusColor,
        border: `1px solid ${statusColor}30`
      }}
    >
      <div className="plc-card-header">
        <span className="plc-brand-icon">{brandIcons}</span>
        <div className="plc-card-info">
          <h4 className="plc-card-name">{plcData.station}</h4>
          <span className="plc-card-brand mono">{plcData.brand} {plcData.model}</span>
        </div>
        <span
          className="plc-status-badge"
          style={{ color: statusColor, borderColor: statusColor }}
        >
          <span className={`status-dot ${plcData.status}`}></span>
          {plcData.status.toUpperCase()}
        </span>
      </div>
      <div className="plc-card-stats">
        <div className="plc-stat">
          <span className="plc-stat-val">{plcData.deviceCount}</span>
          <span className="plc-stat-label">อุปกรณ์</span>
        </div>
        <div className="plc-stat-divider" />
        <div className="plc-stat">
          <span className="plc-stat-val" style={{ color: 'var(--accent-green)' }}>{plcData.onlineDevices}</span>
          <span className="plc-stat-label">ทำงาน</span>
        </div>
        <div className="plc-stat-divider" />
        <div className="plc-stat">
          <span className="plc-stat-val">{plcData.uptime}%</span>
          <span className="plc-stat-label">Uptime</span>
        </div>
        {plcData.errorCount > 0 && (
          <>
            <div className="plc-stat-divider" />
            <div className="plc-stat plc-error-stat">
              <span className="plc-stat-val" style={{ color: 'var(--accent-red)' }}>{plcData.errorCount}</span>
              <span className="plc-stat-label">Errors</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MachineCard({ machine, historyData, onControl }) {
  const isRunning = machine.status === 'running';
  const isWarning = machine.status === 'warning';
  const isError = machine.status === 'error';
  const metricLabel = machine.metricName || 'ความเร็ว';
  const unit = machine.unit || '%';

  return (
    <div className={`machine-card glass-card ${machine.status}`}>
      <div className="machine-card-top">
        <div className="machine-icon-wrap">
          <span className="machine-icon">{machine.icon}</span>
        </div>
        <div className="machine-info">
          <h3 className="machine-name">{machine.name}</h3>
          <span className="machine-id mono">{machine.id}</span>
        </div>
        <div className="machine-status-badge">
          <span className={`status-dot ${machine.status}`}></span>
          <span className="status-text" style={{ color: STATUS_COLOR[machine.status] }}>
            {STATUS_LABEL[machine.status]}
          </span>
        </div>
      </div>

      <div className="machine-metrics-list">
        <div className="metric-row">
          <span className="metric-key">Speed</span>
          <span className="metric-val mono">{machine.speed}{unit}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Temperature</span>
          <span className="metric-val mono">{machine.temp}°C</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Current</span>
          <span className="metric-val mono">{(machine.current || 0).toFixed(1)}A</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Sensor</span>
          <span className="metric-val mono" style={{ color: isRunning ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            {isRunning ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Alarm</span>
          <span className="metric-val mono" style={{ color: isError || isWarning ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {isError || isWarning ? 'ALARM' : 'NORMAL'}
          </span>
        </div>
      </div>

      <div className="machine-controls">
        <button
          className={`btn btn-sm ${isRunning ? 'btn-danger' : 'btn-success'}`}
          onClick={() => onControl(machine.id, isRunning ? 'stop' : 'start')}
          disabled={isError}
        >
          {isRunning ? '⏹ หยุด' : '▶ เปิด'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onControl(machine.id, 'reset')}
        >
          ↺ รีเซ็ต
        </button>
        {(isRunning || isWarning) && (
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,107,53,0.2)', color: 'var(--accent-orange)', border: '1px solid rgba(255,107,53,0.4)' }}
            onClick={() => onControl(machine.id, 'emergency_stop')}
          >
            🚨 E-Stop
          </button>
        )}
      </div>

      {/* PLC Connection Info Strip — แยกออกจาก Gateway Monitor */}
      <PlcInfoStrip plcInfo={machine.plcInfo} />
    </div>
  );
}

export default function MachineStatus({ refreshTrigger, onCommandResult }) {
  const [machines, setMachines] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [mqttStatus, setMqttStatus] = useState(null);
  const [plcSummary, setPlcSummary] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    const result = await api.getStatus();
    if (result.success) {
      setMachines(result.data.machines);
      setMqttStatus(result.data.mqtt);
      setLastUpdate(new Date());

      setHistoryData(prev => {
        const next = { ...prev };
        const now = Date.now();
        Object.values(result.data.machines).forEach(m => {
          if (!next[m.id]) next[m.id] = [];
          next[m.id] = [...next[m.id], { time: now, temp: m.temp }].slice(-15);
        });
        return next;
      });
    }
    // Fetch PLC summary
    const plcResult = await api.getPlcStatus();
    if (plcResult.success) {
      setPlcSummary(plcResult.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refreshTrigger) fetchStatus();
  }, [refreshTrigger]);

  const handleControl = async (device, action, params = {}) => {
    await api.directCommand(device, action, params);
    if (onCommandResult) {
      onCommandResult({ device, action, params, source: 'direct' }, true);
    }
    setTimeout(fetchStatus, 300);
  };

  const handleScenario = async () => {
    const result = await api.triggerScenario();
    if (result.success) {
      playSirenSound();
      if (onCommandResult) {
        onCommandResult({ device: result.data?.device, action: 'scenario_overheat', params: { temp: 100 }, source: 'system' }, true);
      }
    }
    setTimeout(fetchStatus, 300);
  };

  const machineList = Object.values(machines);
  const runningCount = machineList.filter(m => m.status === 'running').length;
  const warningCount = machineList.filter(m => m.status === 'warning').length;
  const errorCount = machineList.filter(m => m.status === 'error').length;

  return (
    <div className="machine-status-panel">
      {/* Summary Bar */}
      <div className="status-summary glass-card">
        <div className="summary-item">
          <span className="summary-val" style={{ color: 'var(--accent-green)' }}>{runningCount}</span>
          <span className="summary-label">Running</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-val" style={{ color: 'var(--text-muted)' }}>
            {machineList.filter(m => m.status === 'stopped').length}
          </span>
          <span className="summary-label">Stopped</span>
        </div>
        
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-val" style={{ color: 'var(--accent-yellow)' }}>{warningCount}</span>
          <span className="summary-label">Warning</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-val" style={{ color: 'var(--accent-red)' }}>{errorCount}</span>
          <span className="summary-label">Error</span>
        </div>
        <div className="summary-divider" />
        <div className="mqtt-status-badge">
          <span className={`status-dot ${mqttStatus?.connected ? 'running' : 'stopped'}`}></span>
          <span className="mqtt-text" style={{ color: mqttStatus?.connected ? 'var(--status-running)' : 'var(--text-muted)' }}>
            {mqttStatus?.connected ? 'MQTT Connected' : 'MQTT Offline'}
          </span>
        </div>
        
        <div style={{ flex: 1 }} />
        <button 
          className="btn btn-danger" 
          style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}
          onClick={handleScenario}
        >
          🚨 จำลองเหตุฉุกเฉิน
        </button>
        {lastUpdate && (
          <span className="last-update mono">
            🔄 {lastUpdate.toLocaleTimeString('th-TH')}
          </span>
        )}
      </div>

      {/* PLC Summary Cards */}
      {plcSummary && plcSummary.plcs && (
        <div className="plc-grid">
          {plcSummary.plcs.map(plc => (
            <PlcSummaryCard key={plc.id} plcData={plc} />
          ))}
        </div>
      )}

      {/* Machine Grid */}
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <span>กำลังโหลดข้อมูลเครื่องจักร...</span>
        </div>
      ) : (
        <div className="machine-grid">
          {machineList.map(m => (
            <MachineCard 
              key={m.id} 
              machine={m} 
              historyData={historyData[m.id]}
              onControl={handleControl} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
