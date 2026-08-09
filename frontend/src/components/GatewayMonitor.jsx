// ============================================================
// GatewayMonitor.jsx - Ultra-Detail Gateway Monitor & PLC Dashboard
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import './GatewayMonitor.css';

// ─── Modbus TCP Frame Builder ──────────────────────────────────
function buildModbusFrame(coilAddr, value) {
  const tid = '00 01';
  const proto = '00 00';
  const len = '00 06';
  const uid = '01';
  const addrNum = parseInt(coilAddr || '1');
  const addrHex = addrNum.toString(16).padStart(4, '0').toUpperCase().match(/.{2}/g).join(' ');
  const val = value ? '01' : '00';
  return `[MBAP] ${tid} ${proto} ${len} | [PDU] ${uid} 0F ${addrHex} 00 01 01 ${val}`;
}

export default function GatewayMonitor({ lastCommand }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'plc_mapping' | 'network'
  const [selectedMachineId, setSelectedMachineId] = useState('conveyor1');
  const [searchQuery, setSearchQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [packetCount, setPacketCount] = useState({ tx: 1042, rx: 1039, err: 3 });
  const startTime = useRef(Date.now());

  const [dashState, setDashState] = useState({
    header: "AI ROBOT OPERATOR",
    aiCommand: '"เปิดสายพาน"',
    gatewayCommand: "START_CONVEYOR",
    gateway: {
      status: "CONNECTED",
      protocol: "Modbus TCP",
      plcIp: "192.168.1.20",
      port: 502
    },
    plcStatus: { plc: "RUNNING", motor: "ON", speed: "50%", temp: "35°C" },
    communication: { tx: "Coil 00001 = TRUE", rx: "SUCCESS", latency: "12 ms" },
    machineName: null,
    machinePlcStation: null,
    machineTerminal: null,
    machineCoil: null,
    plcBrand: null,
    plcModel: null,
    slaveId: null,
    coilAddr: null,
    plcBit: null,
    regAddr: null,
    plcReg: null,
    eventLogs: [
      { time: "22:15:03", message: "START_CONVEYOR → PLC ✓" },
      { time: "22:15:03", message: "Motor status: ON ✓" }
    ]
  });

  const [machineMapping, setMachineMapping] = useState({});
  const [plcStations, setPlcStations] = useState([]);
  const [pulse, setPulse] = useState(false);

  // Live uptime ticker
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const uptimeSeconds = Math.floor((Date.now() - startTime.current) / 1000);
  const uptimeStr = `${String(Math.floor(uptimeSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, '0')}:${String(uptimeSeconds % 60).padStart(2, '0')}`;

  const fetchGatewayData = async () => {
    try {
      // ดึงข้อมูลจาก Gateway + PLC Simulator
      const [gwRes, plcRes] = await Promise.all([
        api.getGatewayStatus(),
        api.getPlcStatus()
      ]);

      if (gwRes.success && gwRes.data) {
        if (gwRes.data.currentDashboardState) {
          setDashState(gwRes.data.currentDashboardState);
        }
        if (gwRes.data.machinePlcMapping) setMachineMapping(gwRes.data.machinePlcMapping);
        if (gwRes.data.plcStationsList) setPlcStations(gwRes.data.plcStationsList);
      }

      // อัพเดท PLC simulation status จาก simulator endpoint
      if (plcRes.success && plcRes.data) {
        // Sync simulation status กับ dashboard state
        const simData = plcRes.data;
        console.log('🔌 PLC Simulator:', simData);
      }
    } catch (err) {
      console.error('Failed to fetch gateway/plc data:', err);
    }
  };

  useEffect(() => { fetchGatewayData(); }, [lastCommand]);

  useEffect(() => {
    if (lastCommand) {
      setPulse(true);
      fetchGatewayData();
      setPacketCount(p => ({ tx: p.tx + 1, rx: p.rx + 1, err: p.err }));
      const timer = setTimeout(() => setPulse(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [lastCommand]);

  const selectedMachine = machineMapping[selectedMachineId] || Object.values(machineMapping)[0];
  const filteredMachines = Object.values(machineMapping).filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.plcStation.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.outputTerminal.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const successRate = packetCount.tx > 0 ? ((packetCount.rx / packetCount.tx) * 100).toFixed(1) : '100.0';

  const modbusFrame = dashState.coilAddr
    ? buildModbusFrame(dashState.coilAddr, dashState.plcStatus?.motor === 'ON')
    : buildModbusFrame('00001', true);

  const generateLadderSnippet = () => {
    const bit = dashState.plcBit || 'M0';
    const terminal = dashState.machineTerminal?.split(' ')[0] || 'Y0';
    const cmd = dashState.gatewayCommand || 'START_CMD';
    return [
      `; ── Rung 1: AI Gateway Command ─────────────────────`,
      `  |──[${cmd}]─────────────(${bit})──|`,
      `  |   Coil Write FC0F → TRUE          |`,
      ``,
      `; ── Rung 2: Output Control ─────────────────────────`,
      `  |──┤${bit}├──────────────────(${terminal})──|`,
      `  |   Coil OK → Output Terminal Enable  |`,
      ``,
      `; ── Rung 3: Feedback Check ──────────────────────────`,
      `  |──┤${terminal}├──[Timer T0 1s]──────( DONE )──|`,
      `  |   Confirm motor running feedback      |`,
    ].join('\n');
  };

  return (
    <div className="gateway-widget-fixed">

      {/* ─── Collapsed HUD Badge ─── */}
      {!isExpanded && (
        <button
          className={`gateway-hud-badge ${pulse ? 'pulse-anim' : ''}`}
          onClick={() => setIsExpanded(true)}
        >
          <div className="hud-status-led">
            <span className="dot green"></span>
            <span className="wave"></span>
          </div>
          <div className="hud-badge-info mono">
            <span className="hud-title">⚡ AI ROBOT OPERATOR</span>
            <span className="hud-sub">{dashState.gateway.plcIp}:{dashState.gateway.port} | Motor: {dashState.plcStatus.motor} | {uptimeStr}</span>
          </div>
          <div className="hud-expand-icon">↗ ขยาย</div>
        </button>
      )}

      {/* ─── EXPANDED DASHBOARD ─── */}
      {isExpanded && (
        <div className={`gateway-grid-card ${pulse ? 'card-glow' : ''}`}>

          {/* Top Bar */}
          <div className="grid-card-topbar">
            <div className="topbar-title mono font-bold">
              <span className="topbar-icon">⚡</span>
              <span>{dashState.header || "AI ROBOT OPERATOR"}</span>
              <span className="topbar-uptime mono">⏱ {uptimeStr}</span>
            </div>
            <div className="topbar-actions">
              <button className={`tab-btn-mini ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>
                📊 Monitor
              </button>
              <button className={`tab-btn-mini ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
                🌐 Network
              </button>
              <button className={`tab-btn-mini ${activeTab === 'plc_mapping' ? 'active' : ''}`} onClick={() => setActiveTab('plc_mapping')}>
                🔌 PLC Map
              </button>
              <button className="btn-minimize" onClick={() => setIsExpanded(false)} title="ย่อขนาด">─</button>
            </div>
          </div>

          {/* ─── TAB: MONITOR ─── */}
          {activeTab === 'monitor' && (
            <div className="grid-dashboard-body mono">

              {/* Stats Bar */}
              <div className="stats-bar">
                <div className="stat-pill">
                  <span className="stat-pill-icon tx-text">↑</span>
                  <span className="stat-pill-label">TX</span>
                  <span className="stat-pill-val yellow-text font-bold">{packetCount.tx.toLocaleString()}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon rx-text">↓</span>
                  <span className="stat-pill-label">RX</span>
                  <span className="stat-pill-val green-text font-bold">{packetCount.rx.toLocaleString()}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon" style={{ color: '#f87171' }}>✕</span>
                  <span className="stat-pill-label">ERR</span>
                  <span className="stat-pill-val red-text font-bold">{packetCount.err}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon green-text">✓</span>
                  <span className="stat-pill-label">Rate</span>
                  <span className="stat-pill-val green-text font-bold">{successRate}%</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label cyan-text">Latency</span>
                  <span className="stat-pill-val cyan-text font-bold">{dashState.communication?.latency || '—'}</span>
                </div>
                <div className="stat-pill">
                  <span className={`stat-pill-led ${dashState.gateway.status === 'CONNECTED' ? 'led-green' : 'led-red'}`}></span>
                  <span className="stat-pill-val green-text font-bold">{dashState.gateway.status}</span>
                </div>
              </div>

              {/* Signal Flow — 2-row table layout */}
              <div className="flow-chain-table">
                {/* Row 1: Nodes + arrows (icons & labels) */}
                <div className="fct-row fct-top">
                  <div className="fct-node fct-ai">
                    <span className="fct-icon">🤖</span>
                    <span className="fct-label">AI MODEL</span>
                  </div>
                  <div className="fct-arrow"><div className="fct-line"></div><span className="fct-tip">▶</span><span className="fct-step">NLP Parse</span></div>
                  <div className="fct-node fct-gw">
                    <span className="fct-icon">⚙️</span>
                    <span className="fct-label">GATEWAY</span>
                  </div>
                  <div className="fct-arrow"><div className="fct-line"></div><span className="fct-tip">▶</span><span className="fct-step">Modbus TCP</span></div>
                  <div className="fct-node fct-plc">
                    <span className="fct-icon">🖥️</span>
                    <span className="fct-label">PLC</span>
                  </div>
                  <div className="fct-arrow"><div className="fct-line"></div><span className="fct-tip">▶</span><span className="fct-step">Output</span></div>
                  <div className="fct-node fct-machine">
                    <span className="fct-icon">⚡</span>
                    <span className="fct-label">MACHINE</span>
                  </div>
                </div>
                {/* Row 2: Values */}
                <div className="fct-row fct-bottom">
                  <div className="fct-val fct-val-ai">{dashState.aiCommand}</div>
                  <div className="fct-spacer"></div>
                  <div className="fct-val fct-val-gw">{dashState.gatewayCommand}</div>
                  <div className="fct-spacer"></div>
                  <div className="fct-val fct-val-plc">{dashState.gateway.plcIp}</div>
                  <div className="fct-spacer"></div>
                  <div className="fct-val fct-val-machine">{dashState.machineTerminal?.split(' ')[0] || '—'}</div>
                </div>
              </div>


              {/* Gateway + PLC Status */}
              <div className="grid-row-split">
                <div className="grid-box box-gateway">
                  <div className="box-label-header">🌐 GATEWAY CONNECTION</div>
                  <div className="box-inner-content">
                    <div className="gw-status-line">
                      <span className={`dot-led ${dashState.gateway.status === 'CONNECTED' ? 'green' : 'red'}`}>●</span>
                      <span className={`status-text font-bold ${dashState.gateway.status === 'CONNECTED' ? 'green-text' : 'red-text'}`}>{dashState.gateway.status}</span>
                    </div>
                    <div className="kv-row"><span className="kv-key">Protocol</span><span className="kv-val cyan-text">{dashState.gateway.protocol}</span></div>
                    <div className="kv-row"><span className="kv-key">PLC IP</span><span className="kv-val yellow-text font-bold">{dashState.gateway.plcIp}</span></div>
                    <div className="kv-row"><span className="kv-key">Port</span><span className="kv-val">{dashState.gateway.port}</span></div>
                    <div className="kv-row"><span className="kv-key">Slave ID</span><span className="kv-val purple-text">{dashState.slaveId || '1'}</span></div>
                    <div className="kv-row"><span className="kv-key">Brand</span><span className="kv-val">{dashState.plcBrand || 'Mitsubishi Electric'}</span></div>
                    <div className="kv-row"><span className="kv-key">Model</span><span className="kv-val">{dashState.plcModel || 'FX5U-32MT/ESS'}</span></div>
                  </div>
                </div>

                <div className="grid-box box-plc-status">
                  <div className="box-label-header">🖥️ PLC STATUS</div>
                  <div className="box-inner-content">
                    <div className="kv-row"><span className="kv-key">PLC CPU</span><span className="kv-val cyan-text font-bold">{dashState.plcStatus.plc}</span></div>
                    <div className="kv-row">
                      <span className="kv-key">Motor</span>
                      <span className={`kv-val font-bold ${dashState.plcStatus.motor === 'ON' ? 'green-text' : 'red-text'}`}>
                        {dashState.plcStatus.motor === 'ON' ? '▶ ON' : '■ OFF'}
                      </span>
                    </div>
                    <div className="kv-row"><span className="kv-key">Speed</span><span className="kv-val yellow-text font-bold">{dashState.plcStatus.speed}</span></div>
                    <div className="kv-row"><span className="kv-key">Temp</span><span className="kv-val orange-text font-bold">{dashState.plcStatus.temp}</span></div>
                    <div className="speed-bar-wrap">
                      <div className="speed-bar-bg">
                        <div
                          className="speed-bar-fill"
                          style={{ width: dashState.plcStatus.speed || '50%' }}
                        ></div>
                      </div>
                      <span className="speed-bar-label">{dashState.plcStatus.speed}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Machine Target + Communication */}
              <div className="grid-row-split">
                <div className="grid-box box-machine-target">
                  <div className="box-label-header">🎯 MACHINE TARGET</div>
                  <div className="box-inner-content">
                    {dashState.machineName ? (
                      <>
                        <div className="machine-target-name font-bold cyan-text">{dashState.machineName}</div>
                        <div className="kv-row"><span className="kv-key">PLC Station</span><span className="kv-val cyan-text">{dashState.machinePlcStation?.split(' ')[0]}</span></div>
                        <div className="kv-row"><span className="kv-key">Terminal</span><span className="kv-val yellow-text">{dashState.machineTerminal}</span></div>
                        <div className="kv-row"><span className="kv-key">Coil (Bit)</span><span className="kv-val purple-text">{dashState.machineCoil}</span></div>
                        <div className="kv-row"><span className="kv-key">Register</span><span className="kv-val">{dashState.regAddr ? `Reg ${dashState.regAddr} (${dashState.plcReg})` : '—'}</span></div>
                      </>
                    ) : (
                      <div className="no-cmd-hint">⏳ รอคำสั่งจาก AI...</div>
                    )}
                  </div>
                </div>

                <div className="grid-box box-comm">
                  <div className="box-label-header">📡 COMMUNICATION</div>
                  <div className="box-inner-content">
                    <div className="comm-line">
                      <span className="comm-direction tx-text">TX →</span>
                      <span className="comm-val">{dashState.communication?.tx}</span>
                    </div>
                    <div className="comm-line">
                      <span className="comm-direction rx-text">RX ←</span>
                      <span className="comm-val green-text font-bold">{dashState.communication?.rx}</span>
                    </div>
                    <div className="comm-line">
                      <span className="comm-key">Latency</span>
                      <span className="comm-val cyan-text">{dashState.communication?.latency}</span>
                    </div>
                    <div className="comm-line">
                      <span className="comm-key">Func Code</span>
                      <span className="comm-val purple-text">FC15 (Write Coils)</span>
                    </div>
                    <div className="comm-line">
                      <span className="comm-key">Coil Addr</span>
                      <span className="comm-val yellow-text">{dashState.coilAddr || '00001'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modbus Frame */}
              <div className="grid-box box-modbus-frame">
                <div className="box-label-header">📦 MODBUS TCP FRAME (Raw Bytes)</div>
                <div className="modbus-frame-content">
                  <div className="frame-raw mono">{modbusFrame}</div>
                  <div className="frame-breakdown">
                    <div className="frame-part"><span className="fp-label">Transaction ID</span><span className="fp-val cyan-text">00 01</span></div>
                    <div className="frame-part"><span className="fp-label">Protocol ID</span><span className="fp-val">00 00</span></div>
                    <div className="frame-part"><span className="fp-label">Length</span><span className="fp-val">00 06</span></div>
                    <div className="frame-part"><span className="fp-label">Unit ID</span><span className="fp-val yellow-text">{String(dashState.slaveId || 1).padStart(2, '0')}</span></div>
                    <div className="frame-part"><span className="fp-label">Func Code</span><span className="fp-val purple-text">0F (Write Coils)</span></div>
                    <div className="frame-part"><span className="fp-label">Coil Address</span><span className="fp-val orange-text">{parseInt(dashState.coilAddr || 1).toString(16).padStart(4, '0').toUpperCase()}</span></div>
                    <div className="frame-part">
                      <span className="fp-label">Value</span>
                      <span className={dashState.plcStatus?.motor === 'ON' ? 'fp-val green-text' : 'fp-val red-text'}>
                        {dashState.plcStatus?.motor === 'ON' ? '01 (TRUE)' : '00 (FALSE)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ladder Diagram */}
              <div className="grid-box box-ladder">
                <div className="box-label-header">📋 LADDER DIAGRAM SNIPPET (IEC 61131-3 LD)</div>
                <div className="ladder-code mono">
                  <pre className="ladder-pre">{generateLadderSnippet()}</pre>
                </div>
              </div>

              {/* Event Log */}
              <div className="grid-box box-event-log">
                <div className="box-label-header">📜 EVENT LOG</div>
                <div className="event-log-list">
                  {dashState.eventLogs && dashState.eventLogs.length > 0 ? (
                    dashState.eventLogs.map((log, index) => (
                      <div key={index} className={`event-log-item ${index === 0 && pulse ? 'log-new' : ''}`}>
                        <span className="log-time">{log.time}</span>
                        <span className="log-badge">INFO</span>
                        <span className="log-msg">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="event-log-item">
                      <span className="log-time">—:—:—</span>
                      <span className="log-badge">INFO</span>
                      <span className="log-msg">System ready</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ─── TAB: NETWORK ─── */}
          {activeTab === 'network' && (
            <div className="grid-dashboard-body mono">

              <div className="grid-box">
                <div className="box-label-header">🌐 NETWORK TOPOLOGY</div>
                <div className="network-topology">

                  <div className="topo-level">
                    <div className="topo-node topo-ai">
                      <div className="topo-icon">🤖</div>
                      <div className="topo-name">AI Server</div>
                      <div className="topo-ip mono">127.0.0.1:3001</div>
                      <div className="topo-status led-green-inline">● Ollama Running</div>
                    </div>
                  </div>

                  <div className="topo-connector">
                    <div className="topo-line"></div>
                    <div className="topo-proto-badge">HTTP REST API</div>
                    <div className="topo-line"></div>
                  </div>

                  <div className="topo-level">
                    <div className="topo-node topo-gateway">
                      <div className="topo-icon">⚙️</div>
                      <div className="topo-name">PyModbus Gateway</div>
                      <div className="topo-ip mono">Node.js Bridge</div>
                      <div className="topo-status led-green-inline">● Active</div>
                    </div>
                  </div>

                  <div className="topo-connector">
                    <div className="topo-line"></div>
                    <div className="topo-proto-badge">Modbus TCP / IP (Port 502)</div>
                    <div className="topo-line"></div>
                  </div>

                  <div className="topo-level topo-plc-row">
                    {plcStations.length > 0 ? plcStations.map(st => (
                      <div key={st.stationId} className="topo-node topo-plc">
                        <div className="topo-icon">🖥️</div>
                        <div className="topo-name">{st.stationId}</div>
                        <div className="topo-ip mono">{st.ip}:{st.port}</div>
                        <div className="topo-brand">{st.brand?.split(' ').slice(0, 2).join(' ')}</div>
                        <div className="topo-status led-green-inline">● {st.machinesCount} machines</div>
                      </div>
                    )) : (
                      ['PLC-01\n192.168.1.20', 'PLC-02\n192.168.1.21', 'PLC-03\n192.168.1.22'].map((p, i) => (
                        <div key={i} className="topo-node topo-plc">
                          <div className="topo-icon">🖥️</div>
                          <div className="topo-name">{p.split('\n')[0]}</div>
                          <div className="topo-ip mono">{p.split('\n')[1]}</div>
                          <div className="topo-status led-green-inline">● Connected</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="grid-row-split">
                <div className="grid-box">
                  <div className="box-label-header">📊 PACKET STATISTICS</div>
                  <div className="box-inner-content">
                    <div className="kv-row"><span className="kv-key">Packets TX</span><span className="kv-val yellow-text font-bold">{packetCount.tx.toLocaleString()}</span></div>
                    <div className="kv-row"><span className="kv-key">Packets RX</span><span className="kv-val green-text font-bold">{packetCount.rx.toLocaleString()}</span></div>
                    <div className="kv-row"><span className="kv-key">Errors</span><span className="kv-val red-text font-bold">{packetCount.err}</span></div>
                    <div className="kv-row"><span className="kv-key">Success Rate</span><span className="kv-val green-text font-bold">{successRate}%</span></div>
                    <div className="kv-row"><span className="kv-key">Avg Latency</span><span className="kv-val cyan-text">{dashState.communication?.latency || '—'}</span></div>
                    <div className="kv-row"><span className="kv-key">Uptime</span><span className="kv-val purple-text font-bold">{uptimeStr}</span></div>
                  </div>
                </div>

                <div className="grid-box">
                  <div className="box-label-header">⚙️ PROTOCOL STACK</div>
                  <div className="box-inner-content">
                    {[
                      { layer: 'Application', proto: 'Modbus TCP', color: '#38bdf8' },
                      { layer: 'Transport', proto: 'TCP/IP (Port 502)', color: '#34d399' },
                      { layer: 'Network', proto: 'IPv4 (192.168.1.x)', color: '#fbbf24' },
                      { layer: 'Data Link', proto: 'Ethernet II (802.3)', color: '#c084fc' },
                      { layer: 'Physical', proto: 'Cat6 UTP / RJ45', color: '#fb923c' },
                    ].map((l, i) => (
                      <div key={i} className="proto-stack-row" style={{ borderLeftColor: l.color }}>
                        <span className="proto-layer">{l.layer}</span>
                        <span className="proto-name mono" style={{ color: l.color }}>{l.proto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid-box">
                <div className="box-label-header">📋 MODBUS FUNCTION CODE REFERENCE</div>
                <div className="modbus-spec-grid">
                  {[
                    { label: 'FC01', name: 'Read Coils', desc: 'อ่านสถานะ Output Bit', active: false },
                    { label: 'FC02', name: 'Read Discrete Inputs', desc: 'อ่าน Input Bit (Read-only)', active: false },
                    { label: 'FC03', name: 'Read Holding Registers', desc: 'อ่านค่า Register 16-bit', active: false },
                    { label: 'FC05', name: 'Write Single Coil', desc: 'เขียน Output Bit เดียว', active: false },
                    { label: 'FC06', name: 'Write Single Register', desc: 'เขียน Register เดียว', active: false },
                    { label: 'FC0F', name: 'Write Multiple Coils', desc: 'เขียน Coils หลายตัว ★ ใช้งานปัจจุบัน', active: true },
                    { label: 'FC10', name: 'Write Multiple Registers', desc: 'เขียน Registers หลายตัว', active: false },
                    { label: 'FC17', name: 'Read/Write Registers', desc: 'อ่านและเขียนพร้อมกัน', active: false },
                  ].map((fc, i) => (
                    <div key={i} className={`fc-card ${fc.active ? 'fc-active' : ''}`}>
                      <span className="fc-code">{fc.label}</span>
                      <span className="fc-name">{fc.name}</span>
                      <span className="fc-desc">{fc.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ─── TAB: PLC MAP ─── */}
          {activeTab === 'plc_mapping' && (
            <div className="grid-dashboard-body machine-map-body">

              <div className="stations-summary-bar">
                {plcStations.map(st => (
                  <div key={st.stationId} className="station-badge-card">
                    <div className="st-name font-bold cyan-text">{st.stationId}</div>
                    <div className="st-brand">{st.brand}</div>
                    <div className="st-ip mono">{st.ip}:{st.port}</div>
                    <div className="st-slave mono">Slave ID: {st.slaveId}</div>
                    <div className="st-count green-text font-bold">{st.machinesCount} เครื่องจักร</div>
                    <div className="st-status led-green-inline">● {st.status || 'CONNECTED'}</div>
                  </div>
                ))}
              </div>

              <div className="map-search-row">
                <input
                  type="text"
                  className="search-input mono"
                  placeholder="🔍 ค้นหาชื่อเครื่องจักร, พอร์ต PLC Terminal, หรือ IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="machine-split-container">

                <div className="machine-list-box">
                  {filteredMachines.map(m => (
                    <div
                      key={m.id}
                      className={`machine-item-card ${selectedMachineId === m.id ? 'active' : ''}`}
                      onClick={() => setSelectedMachineId(m.id)}
                    >
                      <div className="m-title-row font-bold">
                        <span className="m-category-dot" style={{
                          background: m.category?.includes('Robot') ? '#c084fc' :
                            m.category?.includes('Safety') ? '#f87171' :
                              m.category?.includes('Thermal') ? '#fb923c' :
                                m.category?.includes('Material') ? '#fbbf24' : '#38bdf8'
                        }}></span>
                        <span className="m-name">{m.name}</span>
                      </div>
                      <div className="m-sub-row mono">
                        <span className="m-plc cyan-text">{m.plcStation.split(' ')[0]}</span>
                        <span> | <strong className="yellow-text">{m.outputTerminal.split(' ')[0]}</strong></span>
                        <span> | <strong className="purple-text">Coil {m.coilAddr}</strong></span>
                      </div>
                      <div className="m-category-row">{m.category}</div>
                    </div>
                  ))}
                </div>

                {selectedMachine && (
                  <div className="machine-inspector-box mono">
                    <div className="inspector-title font-bold text-yellow">
                      ⚙️ {selectedMachine.name}
                    </div>

                    <div className="inspector-section-label">Hardware Specs</div>
                    <div className="hardware-specs-list">
                      <div className="hw-row"><span className="hw-label">PLC Station</span><span className="hw-val cyan-text font-bold">{selectedMachine.plcStation}</span></div>
                      <div className="hw-row"><span className="hw-label">PLC Brand</span><span className="hw-val">{selectedMachine.plcBrand}</span></div>
                      <div className="hw-row"><span className="hw-label">PLC Model</span><span className="hw-val">{selectedMachine.plcModel}</span></div>
                      <div className="hw-row"><span className="hw-label">IP : Port</span><span className="hw-val green-text font-bold">{selectedMachine.plcIp}:{selectedMachine.modbusPort}</span></div>
                      <div className="hw-row"><span className="hw-label">Slave ID</span><span className="hw-val purple-text font-bold">{selectedMachine.slaveId}</span></div>
                      <div className="hw-row"><span className="hw-label">Coil (Bit)</span><span className="hw-val purple-text font-bold">Coil {selectedMachine.coilAddr} ({selectedMachine.plcBit})</span></div>
                      <div className="hw-row"><span className="hw-label">Register</span><span className="hw-val yellow-text font-bold">Reg {selectedMachine.regAddr} ({selectedMachine.plcReg})</span></div>
                      <div className="hw-row"><span className="hw-label">Output Pin</span><span className="hw-val green-text font-bold">{selectedMachine.outputTerminal}</span></div>
                      <div className="hw-row"><span className="hw-label">Speed/Analog</span><span className="hw-val cyan-text">{selectedMachine.speedTerminal}</span></div>
                      <div className="hw-row"><span className="hw-label">Feedback</span><span className="hw-val orange-text">{selectedMachine.feedbackInput}</span></div>
                      <div className="hw-row"><span className="hw-label">Driver Type</span><span className="hw-val">{selectedMachine.driverType}</span></div>
                    </div>

                    <div className="inspector-section-label">Commands</div>
                    <div className="cmd-chip-row">
                      <span className="cmd-chip chip-start">▶ {selectedMachine.startCmd}</span>
                      <span className="cmd-chip chip-stop">■ {selectedMachine.stopCmd}</span>
                    </div>

                    <div className="wiring-description-box">
                      <div className="wiring-title font-bold text-cyan">🔌 Wiring Details:</div>
                      <div className="wiring-text">{selectedMachine.wiringDetails}</div>
                    </div>

                    <div className="inspector-section-label">Modbus Frame (Start)</div>
                    <div className="mini-frame-box mono">
                      {buildModbusFrame(selectedMachine.coilAddr, true)}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
