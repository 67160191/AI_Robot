// ============================================================
// GatewayMonitor.jsx - ตัวดู Gateway Monitor & แผนผังเครื่องจักรเชื่อมต่อ PLC
// ============================================================

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './GatewayMonitor.css';

export default function GatewayMonitor({ lastCommand }) {
  const [isExpanded, setIsExpanded] = useState(true); // เปิดค้างไว้ที่มุมขวาล่าง
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'plc_mapping' | 'plc_languages'
  const [selectedMachineId, setSelectedMachineId] = useState('conveyor1');
  const [searchQuery, setSearchQuery] = useState('');

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
    plcStatus: {
      plc: "RUNNING",
      motor: "ON",
      speed: "50%",
      temp: "35°C"
    },
    communication: {
      tx: "Coil 00001 = TRUE",
      rx: "SUCCESS",
      latency: "12 ms"
    },
    eventLogs: [
      { time: "22:15:03", message: "START_CONVEYOR → PLC ✓" },
      { time: "22:15:03", message: "Motor status: ON ✓" }
    ]
  });

  const [machineMapping, setMachineMapping] = useState({});
  const [plcStations, setPlcStations] = useState([]);

  const [plcLanguages] = useState([
    { code: "LD", name: "Ladder Diagram", desc: "หน้าตาเหมือนวงจรรีเลย์ เหมาะกับควบคุมเครื่องจักร", tag: "ยอดนิยม" },
    { code: "FBD", name: "Function Block Diagram", desc: "ต่อบล็อก Function เช่น Timer, Counter, AND/OR", tag: "Logic Block" },
    { code: "ST", name: "Structured Text", desc: "คล้ายภาษาโปรแกรม ใช้ทำ Logic ซับซ้อน", tag: "Code" },
    { code: "SFC", name: "Sequential Function Chart", desc: "เหมาะกับกระบวนการที่ทำเป็นขั้น ๆ", tag: "Flowchart" },
    { code: "IL", name: "Instruction List", desc: "คล้าย Assembly แต่เป็นภาษารุ่นเก่าและถูกถอดออกจากมาตรฐานใหม่", tag: "Legacy" }
  ]);

  const [pulse, setPulse] = useState(false);

  // ดึงข้อมูล Gateway & Machine PLC Mapping ล่าสุด
  const fetchGatewayData = async () => {
    try {
      const res = await api.getGatewayStatus();
      if (res.success && res.data) {
        if (res.data.currentDashboardState) {
          setDashState(res.data.currentDashboardState);
        }
        if (res.data.machinePlcMapping) {
          setMachineMapping(res.data.machinePlcMapping);
        }
        if (res.data.plcStationsList) {
          setPlcStations(res.data.plcStationsList);
        }
      }
    } catch (err) {
      console.error('Failed to fetch gateway status:', err);
    }
  };

  useEffect(() => {
    fetchGatewayData();
  }, [lastCommand]);

  useEffect(() => {
    if (lastCommand) {
      setPulse(true);
      fetchGatewayData();
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

  return (
    <div className="gateway-widget-fixed">
      
      {/* ─── Collapsed HUD Badge (เมื่อย่อขนาด) ─── */}
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
            <span className="hud-sub">192.168.1.20:502 | Motor: {dashState.plcStatus.motor}</span>
          </div>

          <div className="hud-expand-icon">
            ↗ ขยาย
          </div>
        </button>
      )}

      {/* ─── GATEWAY MONITOR GRID DASHBOARD ─── */}
      {isExpanded && (
        <div className={`gateway-grid-card ${pulse ? 'card-glow' : ''}`}>
          
          {/* Top Bar Header & Tabs */}
          <div className="grid-card-topbar">
            <div className="topbar-title mono font-bold">
              <span className="topbar-icon">⚡</span>
              <span>{dashState.header || "AI ROBOT OPERATOR"}</span>
            </div>

            <div className="topbar-actions">
              <button
                className={`tab-btn-mini ${activeTab === 'monitor' ? 'active' : ''}`}
                onClick={() => setActiveTab('monitor')}
              >
                📊 Gateway
              </button>
              <button
                className={`tab-btn-mini ${activeTab === 'plc_mapping' ? 'active' : ''}`}
                onClick={() => setActiveTab('plc_mapping')}
              >
                🔌 เครื่องจักร & PLC Map
              </button>
              <button
                className={`tab-btn-mini ${activeTab === 'plc_languages' ? 'active' : ''}`}
                onClick={() => setActiveTab('plc_languages')}
              >
                📜 ภาษา PLC
              </button>
              <button
                className="btn-minimize"
                onClick={() => setIsExpanded(false)}
                title="ย่อขนาด"
              >
                ─
              </button>
            </div>
          </div>

          {/* TAB 1: GRID MONITOR DASHBOARD (ตรงตาม ASCII Layout ของผู้ใช้เป๊ะ) */}
          {activeTab === 'monitor' && (
            <div className="grid-dashboard-body mono">
              
              {/* Row 1: AI COMMAND & GATEWAY */}
              <div className="grid-row-split">
                
                {/* Box 1: AI COMMAND */}
                <div className="grid-box box-ai-cmd">
                  <div className="box-label-header">AI COMMAND</div>
                  <div className="box-inner-content">
                    <div className="ai-cmd-text font-bold">{dashState.aiCommand}</div>
                    <div className="arrow-down-icon">↓</div>
                    <div className="gateway-cmd-text font-bold">{dashState.gatewayCommand}</div>
                  </div>
                </div>

                {/* Box 2: GATEWAY */}
                <div className="grid-box box-gateway">
                  <div className="box-label-header">GATEWAY</div>
                  <div className="box-inner-content">
                    <div className="gw-status-line">
                      <span className="dot-led green">●</span>
                      <span className="status-text font-bold green-text">{dashState.gateway.status}</span>
                    </div>
                    <div className="gw-info-line">Protocol: {dashState.gateway.protocol}</div>
                    <div className="gw-info-line">PLC IP: {dashState.gateway.plcIp}</div>
                    <div className="gw-info-line">Port: {dashState.gateway.port}</div>
                  </div>
                </div>

              </div>

              {/* Row 2: PLC STATUS & COMMUNICATION */}
              <div className="grid-row-split">
                
                {/* Box 3: PLC STATUS */}
                <div className="grid-box box-plc-status">
                  <div className="box-label-header">PLC STATUS</div>
                  <div className="box-inner-content">
                    <div className="stat-line">
                      <span className="stat-key">PLC:</span>
                      <span className="stat-val cyan-text font-bold">{dashState.plcStatus.plc}</span>
                    </div>
                    <div className="stat-line">
                      <span className="stat-key">Motor:</span>
                      <span className={`stat-val font-bold ${dashState.plcStatus.motor === 'ON' ? 'green-text' : 'red-text'}`}>
                        {dashState.plcStatus.motor}
                      </span>
                    </div>
                    <div className="stat-line">
                      <span className="stat-key">Speed:</span>
                      <span className="stat-val yellow-text font-bold">{dashState.plcStatus.speed}</span>
                    </div>
                    <div className="stat-line">
                      <span className="stat-key">Temp:</span>
                      <span className="stat-val orange-text font-bold">{dashState.plcStatus.temp}</span>
                    </div>
                  </div>
                </div>

                {/* Box 4: COMMUNICATION */}
                <div className="grid-box box-comm">
                  <div className="box-label-header">COMMUNICATION</div>
                  <div className="box-inner-content">
                    <div className="comm-line">
                      <span className="comm-direction tx-text">TX →</span> {dashState.communication.tx}
                    </div>
                    <div className="comm-line">
                      <span className="comm-direction rx-text">RX ←</span> <span className="green-text font-bold">{dashState.communication.rx}</span>
                    </div>
                    <div className="comm-line">
                      <span className="comm-key">Latency:</span> <span className="cyan-text">{dashState.communication.latency}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 3: EVENT LOG */}
              <div className="grid-box box-event-log">
                <div className="box-label-header">EVENT LOG</div>
                <div className="event-log-list">
                  {dashState.eventLogs && dashState.eventLogs.length > 0 ? (
                    dashState.eventLogs.map((log, index) => (
                      <div key={index} className="event-log-item">
                        <span className="log-time">{log.time}</span>
                        <span className="log-msg">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="event-log-item">
                      <span className="log-time">22:15:03</span>
                      <span className="log-msg">START_CONVEYOR → PLC ✓</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MACHINE PLC MAP (แผนผังเครื่องจักรเชื่อมต่อ PLC แบบรายละเอียด) */}
          {activeTab === 'plc_mapping' && (
            <div className="grid-dashboard-body machine-map-body">
              
              {/* PLC Stations Header Summary */}
              <div className="stations-summary-bar">
                {plcStations.map(st => (
                  <div key={st.stationId} className="station-badge-card">
                    <div className="st-name font-bold cyan-text">{st.stationId}</div>
                    <div className="st-brand">{st.brand}</div>
                    <div className="st-ip mono">{st.ip}:{st.port}</div>
                    <div className="st-count green-text font-bold">{st.machinesCount} เครื่องจักร</div>
                  </div>
                ))}
              </div>

              {/* Search Machine Box */}
              <div className="map-search-row">
                <input
                  type="text"
                  className="search-input mono"
                  placeholder="🔍 ค้นหาชื่อเครื่องจักร, พอร์ต PLC Terminal, หรือ IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Split View: Left List, Right Inspector */}
              <div className="machine-split-container">
                
                {/* Left Machine List */}
                <div className="machine-list-box">
                  {filteredMachines.map(m => (
                    <div
                      key={m.id}
                      className={`machine-item-card ${selectedMachineId === m.id ? 'active' : ''}`}
                      onClick={() => setSelectedMachineId(m.id)}
                    >
                      <div className="m-title-row font-bold">
                        <span className="m-name">{m.name}</span>
                      </div>
                      <div className="m-sub-row mono">
                        <span className="m-plc cyan-text">{m.plcStation.split(' ')[0]}</span>
                        <span> | Pin: <strong className="yellow-text">{m.outputTerminal.split(' ')[0]}</strong></span>
                        <span> | Coil: <strong className="purple-text">{m.coilAddr} ({m.plcBit})</strong></span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Detailed Hardware Inspector */}
                {selectedMachine && (
                  <div className="machine-inspector-box mono">
                    <div className="inspector-title font-bold text-yellow">
                      ⚙️ {selectedMachine.name}
                    </div>

                    <div className="hardware-specs-list">
                      <div className="hw-row">
                        <span className="hw-label">PLC Station:</span>
                        <span className="hw-val cyan-text font-bold">{selectedMachine.plcStation}</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">PLC Model:</span>
                        <span className="hw-val">{selectedMachine.plcBrand} ({selectedMachine.plcModel})</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">IP Address:</span>
                        <span className="hw-val green-text font-bold">{selectedMachine.plcIp}:{selectedMachine.modbusPort} (Slave ID: {selectedMachine.slaveId})</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Modbus Coil (Bit):</span>
                        <span className="hw-val purple-text font-bold">Coil {selectedMachine.coilAddr} ({selectedMachine.plcBit})</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Modbus Register:</span>
                        <span className="hw-val yellow-text font-bold">Reg {selectedMachine.regAddr} ({selectedMachine.plcReg})</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Physical Terminal:</span>
                        <span className="hw-val green-text font-bold">{selectedMachine.outputTerminal}</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Speed/Analog Pin:</span>
                        <span className="hw-val cyan-text">{selectedMachine.speedTerminal}</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Feedback Pin:</span>
                        <span className="hw-val orange-text">{selectedMachine.feedbackInput}</span>
                      </div>
                      <div className="hw-row">
                        <span className="hw-label">Motor Driver Type:</span>
                        <span className="hw-val">{selectedMachine.driverType}</span>
                      </div>
                    </div>

                    <div className="wiring-description-box">
                      <div className="wiring-title font-bold text-cyan">🔌 วงจรและการต่อสายสัญญาณ (Hardware Wiring Details):</div>
                      <div className="wiring-text">{selectedMachine.wiringDetails}</div>
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 3: PLC LANGUAGES */}
          {activeTab === 'plc_languages' && (
            <div className="grid-dashboard-body plc-lang-body">
              <div className="plc-lang-title mono font-bold">
                📚 ภาษาเขียนโปรแกรม PLC (IEC 61131-3 Standard)
              </div>

              <div className="plc-lang-list">
                {plcLanguages.map((lang) => (
                  <div key={lang.code} className="lang-card">
                    <div className="lang-card-header">
                      <span className="lang-code mono">{lang.code}</span>
                      <span className="lang-name">{lang.name}</span>
                      <span className="lang-tag">{lang.tag}</span>
                    </div>
                    <div className="lang-desc">
                      {lang.desc}
                    </div>
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
