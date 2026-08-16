// ============================================================
// ConveyorPanel.jsx — Factory I/O Conveyor Modbus Control
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import './ConveyorPanel.css';

export default function ConveyorPanel({ deviceId = "conveyor1", title = "สายพาน 1" }) {
  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [log, setLog]               = useState([]);
  const logRef                      = useRef(null);

  // ─── Fetch status ──────────────────────────────────────
  const fetchStatus = async () => {
    try {
      const res = await api.getDeviceStatus(deviceId);
      if (res.success || res.deviceId) { // some generic check
        setStatus(res.data || res); // depending on how generic api wraps
      }
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('th-TH');
    setLog(prev => [...prev.slice(-49), { time, msg, type }]);
  };

  // ─── Actions ───────────────────────────────────────────
  const handleStart = async () => {
    setActionLoading(true);
    addLog(`▶ กำลังส่งคำสั่ง START ${title}...`, 'pending');
    try {
      const res = await api.startDevice(deviceId);
      if (res.success || res.modbusWritten) {
        addLog(`✅ ${res.data?.message || res.message || 'Started'}`, 'success');
        setLastAction({ action: 'start', ok: true, time: new Date() });
      } else {
        addLog(`❌ Error: ${res.error || res.data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
    }
    await fetchStatus();
    setActionLoading(false);
  };

  const handleStop = async () => {
    setActionLoading(true);
    addLog(`⏹ กำลังส่งคำสั่ง STOP ${title}...`, 'pending');
    try {
      const res = await api.stopDevice(deviceId);
      if (res.success || res.modbusWritten) {
        addLog(`✅ ${res.data?.message || res.message || 'Stopped'}`, 'success');
        setLastAction({ action: 'stop', ok: true, time: new Date() });
      } else {
        addLog(`❌ Error: ${res.error || res.data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
    }
    await fetchStatus();
    setActionLoading(false);
  };

  const handleReconnect = async () => {
    addLog('🔌 กำลังเชื่อมต่อ Modbus ใหม่...', 'pending');
    try {
      await api.reconnectModbus();
      addLog('🔌 ส่งคำสั่ง reconnect แล้ว รอ 3 วินาที...', 'info');
      setTimeout(fetchStatus, 3000);
    } catch(err) {
      addLog('❌ Reconnect failed', 'error');
    }
  };

  // ─── Derived state ─────────────────────────────────────
  // handle unwrapped or wrapped api responses
  const s = status?.data || status;
  
  const connected     = s?.modbusConnected ?? false;
  const coilOn        = s?.coilState === true;
  const sensor0       = s?.sensorInput0;
  const sensor1       = s?.sensorInput1;
  const machineStatus = s?.machineStatus || 'unknown';
  const isRunning     = coilOn || machineStatus === 'running';
  const coilAddress   = s?.coilAddress ?? '-';

  return (
    <div className="conveyor-panel">

      {/* ── Header ── */}
      <div className="cp-header">
        <div className="cp-title-group">
          <span className="cp-icon">🏭</span>
          <div>
            <h2 className="cp-title">{title}</h2>
            <span className="cp-subtitle mono">Factory I/O · Modbus TCP · Coil {coilAddress}</span>
          </div>
        </div>
        <div className={`cp-modbus-badge ${connected ? 'connected' : 'disconnected'}`}>
          <span className={`cp-dot ${connected ? 'pulse' : ''}`} />
          <span>{connected ? 'Modbus Connected' : 'Modbus Offline'}</span>
          <span className="mono cp-host">{s?.modbusHost}:{s?.modbusPort}</span>
        </div>
      </div>

      {/* ── Main Conveyor Visualizer ── */}
      <div className="cp-visualizer">
        {/* Belt animation */}
        <div className={`cp-belt-track ${isRunning ? 'running' : ''}`}>
          <div className="cp-belt-label-left">INPUT</div>
          <div className="cp-belt-wrap">
            <div className={`cp-belt ${isRunning ? 'running' : ''}`}>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="cp-belt-stripe" />
              ))}
            </div>
            {/* Box animation when running */}
            {isRunning && (
              <div className="cp-box-container">
                <div className="cp-box" style={{ animationDelay: '0s' }}>📦</div>
                <div className="cp-box" style={{ animationDelay: '1.5s' }}>📦</div>
              </div>
            )}
          </div>
          <div className="cp-belt-label-right">OUTPUT</div>
        </div>

        {/* Status Overlay */}
        <div className={`cp-status-pill ${isRunning ? 'on' : 'off'}`}>
          <span className={`cp-status-dot ${isRunning ? 'pulse-green' : ''}`} />
          {isRunning ? '▶ RUNNING' : '⏹ STOPPED'}
        </div>
      </div>

      {/* ── Modbus Info Cards ── */}
      <div className="cp-info-grid">
        <div className="cp-info-card">
          <span className="cp-info-label">Slave ID</span>
          <span className="cp-info-val mono">1</span>
        </div>
        <div className="cp-info-card">
          <span className="cp-info-label">Coil Address</span>
          <span className="cp-info-val mono">{coilAddress}</span>
        </div>
        <div className={`cp-info-card ${coilOn ? 'on' : 'off'}`}>
          <span className="cp-info-label">Coil {coilAddress} State</span>
          <span className={`cp-info-val mono ${coilOn ? 'text-green' : 'text-muted'}`}>
            {status === null ? '...' : coilOn ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="cp-info-card">
          <span className="cp-info-label">Machine State</span>
          <span className={`cp-info-val mono ${
            machineStatus === 'running' ? 'text-green' :
            machineStatus === 'error'   ? 'text-red' :
            machineStatus === 'warning' ? 'text-yellow' : 'text-muted'
          }`}>
            {machineStatus.toUpperCase()}
          </span>
        </div>
        <div className={`cp-info-card ${sensor0 ? 'on' : ''}`}>
          <span className="cp-info-label">Input 0 (Sensor)</span>
          <span className={`cp-info-val mono ${sensor0 ? 'text-green' : 'text-muted'}`}>
            {sensor0 === null || sensor0 === undefined ? '—' : sensor0 ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className={`cp-info-card ${sensor1 ? 'on' : ''}`}>
          <span className="cp-info-label">Input 1 (Running)</span>
          <span className={`cp-info-val mono ${sensor1 ? 'text-green' : 'text-muted'}`}>
            {sensor1 === null || sensor1 === undefined ? '—' : sensor1 ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* ── Control Buttons ── */}
      <div className="cp-controls">
        <button
          id={`${deviceId}-start-btn`}
          className={`cp-btn cp-btn-start ${isRunning ? 'active' : ''}`}
          onClick={handleStart}
          disabled={actionLoading || isRunning}
        >
          {actionLoading && !isRunning ? (
            <span className="cp-spinner" />
          ) : (
            <span className="cp-btn-icon">▶</span>
          )}
          <span>เปิดสายพาน</span>
          <span className="cp-btn-sub">Coil {coilAddress} = ON</span>
        </button>

        <button
          id={`${deviceId}-stop-btn`}
          className={`cp-btn cp-btn-stop ${!isRunning ? 'active' : ''}`}
          onClick={handleStop}
          disabled={actionLoading || !isRunning}
        >
          {actionLoading && isRunning ? (
            <span className="cp-spinner" />
          ) : (
            <span className="cp-btn-icon">⏹</span>
          )}
          <span>ปิดสายพาน</span>
          <span className="cp-btn-sub">Coil {coilAddress} = OFF</span>
        </button>

        <button
          id={`${deviceId}-reconnect-btn`}
          className="cp-btn cp-btn-reconnect"
          onClick={handleReconnect}
          disabled={connected}
        >
          <span className="cp-btn-icon">🔌</span>
          <span>เชื่อมต่อใหม่</span>
          <span className="cp-btn-sub">Reconnect</span>
        </button>
      </div>

      {/* ── Modbus Frame Info ── */}
      <div className="cp-frame-info glass-card">
        <div className="cp-frame-title">📡 Modbus TCP Frame Info</div>
        <div className="cp-frame-rows">
          <div className="cp-frame-row">
            <span className="cp-frame-key">Host</span>
            <span className="cp-frame-val mono">{s?.modbusHost || '127.0.0.1'}:{s?.modbusPort || 502}</span>
          </div>
          <div className="cp-frame-row">
            <span className="cp-frame-key">Function Code (Write)</span>
            <span className="cp-frame-val mono">FC05 — Write Single Coil</span>
          </div>
          <div className="cp-frame-row">
            <span className="cp-frame-key">Output Address</span>
            <span className="cp-frame-val mono">Coil {coilAddress} → {title}</span>
          </div>
          <div className="cp-frame-row">
            <span className="cp-frame-key">Input Address</span>
            <span className="cp-frame-val mono">Input 0 = Sensor, Input 1 = Running</span>
          </div>
          <div className="cp-frame-row">
            <span className="cp-frame-key">Library</span>
            <span className="cp-frame-val mono">modbus-serial v8.x</span>
          </div>
        </div>
      </div>

      {/* ── Activity Log ── */}
      <div className="cp-log-section">
        <div className="cp-log-header">
          <span>📋 Activity Log</span>
          <button className="cp-log-clear" onClick={() => setLog([])}>ล้าง</button>
        </div>
        <div className="cp-log-body" ref={logRef}>
          {log.length === 0 ? (
            <div className="cp-log-empty">ยังไม่มีกิจกรรม...</div>
          ) : (
            log.map((entry, i) => (
              <div key={i} className={`cp-log-entry log-${entry.type}`}>
                <span className="cp-log-time mono">[{entry.time}]</span>
                <span className="cp-log-msg">{entry.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
