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
    </div>
  );
}

export default function MachineStatus({ refreshTrigger }) {
  const [machines, setMachines] = useState({});
  const [mqttStatus, setMqttStatus] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    const result = await api.getStatus();
    if (result.success) {
      setMachines(result.data.machines);
      setMqttStatus(result.data.mqtt);
      setLastUpdate(new Date());
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
