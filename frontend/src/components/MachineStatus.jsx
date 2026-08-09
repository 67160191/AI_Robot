// ============================================================
// MachineStatus Component - Real-time Dashboard
// ============================================================
import { useState, useEffect } from 'react';
import { api } from '../services/api';
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

function TempGauge({ value, max = 100 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value > 80 ? 'var(--accent-red)' : value > 60 ? 'var(--accent-yellow)' : 'var(--primary)';
  return (
    <div className="temp-gauge">
      <div className="gauge-bar">
        <div
          className="gauge-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      <span className="gauge-label" style={{ color }}>{value}°C</span>
    </div>
  );
}

function MetricGauge({ value, unit = "%" }) {
  const pct = Math.min(value, 100);
  return (
    <div className="speed-ring-wrap">
      <svg viewBox="0 0 60 60" className="speed-ring">
        <circle cx="30" cy="30" r="24" fill="none" stroke="var(--bg-surface)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r="24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
          style={{ filter: 'drop-shadow(0 0 4px var(--primary))' }}
        />
      </svg>
      <div className="speed-ring-label">
        <span className="speed-val mono">{pct}</span>
        <span className="speed-unit" style={{ fontSize: unit.length > 2 ? '9px' : '11px' }}>{unit}</span>
      </div>
    </div>
  );
}

function getMetricIcon(metricName = '') {
  if (metricName.includes('ร้อน')) return '🔥';
  if (metricName.includes('แรงดัน')) return '💨';
  if (metricName.includes('สว่าง') || metricName.includes('ไฟ')) return '💡';
  if (metricName.includes('เย็น')) return '❄️';
  if (metricName.includes('ไหล')) return '💧';
  if (metricName.includes('ลม')) return '🌀';
  if (metricName.includes('รอก')) return '🏗️';
  return '⚡';
}

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

function MachineCard({ machine, onControl }) {
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

      <div className="machine-metrics">
        <div className="metric">
          <span className="metric-label">🌡️ อุณหภูมิ</span>
          <TempGauge value={machine.temp} />
        </div>
        <div className="metric metric-speed">
          <span className="metric-label">{getMetricIcon(metricLabel)} {metricLabel}</span>
          <MetricGauge value={machine.speed} unit={unit} />
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

export default function MachineStatus({ refreshTrigger }) {
  const [machines, setMachines] = useState({});
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
          <span className="mono" style={{ fontSize: '11px' }}>
            MQTT: {mqttStatus?.mode || 'N/A'}
          </span>
        </div>
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
          {machineList.map(machine => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onControl={handleControl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
