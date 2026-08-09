# 🤖 AI Robot Operator - Multi-PLC Simulation Prototype

## 📋 ภาพรวม

โปรเจคนี้คือ **Simulation/Dashboard-only prototype** ที่จำลองการทำงานของระบบควบคุมเครื่องจักรผ่าน AI โดยไม่ต้องมี Hardware PLC จริง

### สิ่งที่ทำให้ใช้งานได้ (Simulation)
- ✅ AI Command Parsing ผ่าน Ollama LLM
- ✅ Vocab Matching (Fast Path, ~0ms)
- ✅ Machine State Management (In-Memory)
- ✅ Temperature/Parameter Simulation
- ✅ Multi-PLC Architecture (3 PLCs, 12 Machines)
- ✅ Dashboard Real-time Updates
- ✅ Command History + Confirmation Flow
- ✅ Vocabulary Manager
- ✅ PLC Simulator + Gateway Monitor

### สิ่งที่ทำงานแบบ Simulation เท่านั้น (ไม่มี Hardware)
- ⚠️ MQTT Publishing (แสดง payload ที่ "จะส่ง")
- ⚠️ PLC Modbus TCP Write/Read (มีข้อมูล Mapping ครบ แต่ไม่ได้เขียนจริง)
- ⚠️ Machine Feedback (จำลองอุณหภูมิขึ้น/ลง อัตโนมัติ)

---

## 🏗️ Architecture

```
┌─────────────┐     HTTP/REST     ┌──────────────┐
│   Frontend   │ ◄──────────────► │  Backend API │
│  (React)     │                   │  (Express)   │
└─────────────┘                   └──────┬───────┘
     ▲                                      │
     │                WebSocket / 3s Poll   │
     │                                      ▼
     │                            ┌───────────────┐
     │                            │  Services     │
     │                            │  - machineState│
     │                            │  - plcSimulator│
     │                            │  - gatewayService│
     │                            └───────┬───────┘
     │                                    │
     ▼                    Simulated PLC   ▼
┌─────────────┐                   ┌──────────────┐
│  Dashboard   │                   │  PLC Simulator│
│  Real-time    │◄────────────────►│  (3 Stations) │
└─────────────┘                   └──────────────┘
```

---

## 📦 Multi-PLC Configuration

### PLC Stations (3 ตัว)

| Station | ชื่อ | Brand | Model | IP | Devices |
|---------|------|-------|-------|-----|---------|
| **PLC-01** | Main Assembly Line | Mitsubishi FX5U | FX5U-32MT/ESS | 192.168.1.20 | 5 machines |
| **PLC-02** | Robot & AGV Cell | Siemens S7-1200 | CPU 1214C | 192.168.1.21 | 2 machines |
| **PLC-03** | Utility & Environmental | Schneider Modicon | M221 | 192.168.1.22 | 5 machines |

### Machines (12 ตัว) - ทุกตัวรองรับ Multi-PLC

#### PLC-01 Devices (Mitsubishi FX5U)
| ID | ชื่อ | Parameters เพิ่ม |
|----|------|------------------|
| conveyor1 | สายพานลำเลียง 1 | speed, temp |
| conveyor2 | สายพานลำเลียง 2 | speed, temp |
| motor1 | มอเตอร์ขับเคลื่อนหลัก | current (A), voltage (V) |
| pump1 | ปั๊มน้ำหล่อเย็น | speed, temp |
| fan1 | พัดลมระบายความร้อน | coolingLevel, temp |

#### PLC-02 Devices (Siemens S7-1200)
| ID | ชื่อ | Parameters เพิ่ม |
|----|------|------------------|
| robot1 | หุ่นยนต์แขนกลประกอบชิ้นส่วน | position, gripper |
| agv1 | รถ AGV ลำเลียง | battery (%), direction |

#### PLC-03 Devices (Schneider M221)
| ID | ชื่อ | Parameters เพิ่ม |
|----|------|------------------|
| heater1 | เตาอบอบชิ้นส่วน | targetTemp (°C) |
| compressor1 | ปั๊มลมแรงดันสูง | pressure (PSI) |
| crane1 | เครนยกสินค้า | load (kg), height (m) |
| light1 | ไฟสัญญาณเตือน | color (on/off/red/yellow/green) |
| chiller1 | เครื่องทำความเย็นหลัก | speed, temp |

---

## 📁 โครงสร้างไฟล์

### Backend Config
```
backend/
├── config/
│   ├── plcs.json           # PLC Station definitions (3 ตัว)
│   └── machines.json       # Machine definitions + params (12 ตัว)
├── services/
│   ├── plcSimulator.js     # PLC Simulation engine
│   ├── machineState.js     # State management + Multi-PLC sync
│   ├── gatewayService.js   # Gateway + PLC info API
│   ├── ollamaService.js    # AI Command Parsing
│   ├── vocabularyService.js # Alias Matching
│   ├── mqttService.js      # MQTT (Simulation)
│   └── historyService.js   # Command History
├── routes/
│   └── command.js          # API endpoints + PLC simulator APIs
└── server.js               # Express server entry point
```

### Frontend Components
```
frontend/src/
├── components/
│   ├── MachineStatus.jsx   # Dashboard + PLC Summary Cards (ใหม่)
│   ├── MachineStatus.css   # PLC grid styles (ใหม่)
│   ├── GatewayMonitor.jsx  # PLC Mapping Tab
│   ├── ChatPanel.jsx       # AI Chat interface
│   ├── CommandHistory.jsx  # History log
│   └── VocabPanel.jsx      # Vocabulary manager
├── services/
│   └── api.js              # API client + PLC endpoints (ใหม่)
└── App.jsx                 # Main app layout
```

---

## 🔌 New API Endpoints (Multi-PLC Support)

### PLC Status & Telemetry
```
GET /api/command/plc/status           # PLC summary (3 stations)
GET /api/command/plc/telemetry/:plcId # PLC-specific telemetry
GET /api/command/plc/devices/:deviceId # Device-to-PLC info
GET /api/command/plc/mapping          # Full device-to-PLC mapping
```

### Existing Endpoints (still work)
```
GET /api/command/gateway/status       # Now includes simPLCs data
GET /api/command/gateway/logs         # Gateway event logs
GET /api/command/gateway/explainer    # PLC language reference
GET /api/command/status               # All machines + MQTT + gateway
GET /api/command/history              # Command history
GET /api/command/models               # Available Ollama models

POST /api/command                      # AI parse (no execute)
POST /api/command/execute              # Execute with confirmation
POST /api/command/direct               # Quick control (no AI)
```

---

## 🎨 Dashboard Features (Multi-PLC)

### MachineStatus Component Updates
1. **PLC Summary Cards** (แถบบนสุด)
   - แสดง 3 การ์ด (หนึ่งต่อ PLC)
   - Brand icons (🔴 Mitsubishi, 🔵 Siemens, 🟢 Schneider)
   - Device count, Online devices, Uptime
   - Error count (ถ้ามี)

2. **Machine Cards** (Grid 12 ตัว)
   - แต่ละเครื่องแสดง PLC Station badge
   - PLC IP, Coil address, Terminal info ใน Info Strip
   - สีของ badge แยกตาม PLC station
     - PLC-01: #00c896 (green)
     - PLC-02: #4f9eff (blue)
     - PLC-03: #ff9f4a (orange)

### GatewayMonitor Component
- **Tab 1: Monitor** — Signal flow, PLC status, Event logs
- **Tab 2: Network** — Topology diagram, Protocol stack, Modbus reference
- **Tab 3: PLC Map** — Machine-to-PLC mapping viewer (แก้ไขแล้วรองรับ Multi-PLC)

---

## ⚙️ การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. ติดตั้ง Ollama AI Model (จำเป็นสำหรับ AI Parse)
```bash
# ดาวน์โหลด Ollama จาก https://ollama.ai
# ติดตั้ง model (ตัวอย่าง):
ollama pull llama3.2
```

### 3. รัน Application
```bash
# Terminal 1: Backend
cd backend
npm start
# Server จะทำงานที่ http://localhost:3001

# Terminal 2: Frontend
cd frontend
npm run dev
# Vite จะทำงานที่ http://localhost:5173
```

### 4. เข้าใช้งาน
- เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`
- Dashboard จะแสดงเครื่องจักร 12 ตัวใน 3 PLC stations
- พิมพ์คำสั่งใน Chat: "เปิดสายพาน 1" → Confirm → Execute
- Machine status จะอัพเดท real-time (ทุก 3 วินาที)

---

## 🎯 สิ่งที่ทำงานได้จริง (เมื่อไม่มี Hardware)

### ✅ AI Command Parsing Flow
```
User: "เปิดสายพาน 1 ความเร็ว 80"
  ↓
Frontend → Backend POST /api/command
  ↓
Vocab Service → Match aliases (~0ms ถ้า match)
  ↓ (ถ้าไม่ match ใน vocab)
Ollama LLM → Parse เป็น JSON
  ↓
Frontend → แสดง Confirm Dialog
  ↓
User Confirm → POST /api/command/execute
  ↓
machineState.execute() → อัพเดท state + PLC simulator
  ↓
Dashboard → อัพเดทการ์ด real-time (ทุก 3 วินาที)
```

### ✅ Temperature Simulation
- เมื่อเครื่อง running → อุณหภูมิเพิ่มขึ้นเรื่อยๆ
- เมื่อเครื่อง stopped → อุณหภูมิลดลงช้าๆ
- Warning system: ถ้า temp > warningTemp → status = "warning"

### ✅ Multi-Parameter Support
แต่ละ machine มี parameters เพิ่มเติมตาม type:
- **motor1**: current (A), voltage (V) — อัพเดทอัตโนมัติเมื่อ running
- **agv1**: battery (%) — ลดลงเมื่อ running
- **heater1**: targetTemp (°C) = speed × 1.8
- **compressor1**: pressure (PSI) = speed × 1.2

---

## 🔧 การแก้ไข/เพิ่มเติม

### เพิ่ม Machine ใหม่
1. แก้ `backend/config/plcs.json` → เพิ่ม device ใน devices array ของ PLC ที่ต้องการ
2. แก้ `backend/config/machines.json` → เพิ่ม entry พร้อม parameters ที่ต้องการ
3. Restart backend (PLC simulator จะสร้าง state อัตโนมัติ)

### เพิ่ม Parameters ให้ Machine ที่มี
ใน `machines.json` แก้ `additionalParams`:
```json
{
  "id": "motor1",
  ...
  "additionalParams": {
    "current":     { "value": 0, "unit": "A" },
    "voltage":     { "value": 0, "unit": "V" },
    "frequency":   { "value": 0, "unit": "Hz", "new": true },  // เพิ่มใหม่
    "temperature": { "value": 0, "unit": "°C", "new": true }   // เพิ่มใหม่
  }
}
```

### เปลี่ยน PLC IP/Config
แก้ไข `backend/config/plcs.json`:
```json
{
  "id": "plc-main",
  "station": "PLC-01",
  "brand": "Mitsubishi Electric",
  "model": "FX5U-32MT/ESS",
  "ip": "192.168.1.XX",  // เปลี่ยน IP
  ...
}
```

---

## 📊 Simulation Data Flow Diagram

```
┌─────────────── PLC Simulator ───────────────┐
│                                               │
│  plcSimulator.js:                           │
│  ├── createPLC(id, config) → PLC state      │
│  ├── updateDeviceStatus(device, status)     │
│  ├── getSummary() → { plcs: [...] }         │
│  └── getTelemetry(plcId) → full telemetry   │
│                                               │
└─────────────── Machine State ─────────────────┘
                                                   │
                                                   ▼
                                           machineState.js:
                                           ├── getAll() → all states
                                           ├── execute(device, action)
                                           ├── syncToPLC() → PLC sim
                                           └── Temp simulation (3s interval)

```

---

## 🚀 Next Steps (สำหรับการพัฒนาต่อ)

### 1. เชื่อมต่อ Hardware จริง
- แก้ `gatewayService.js` → ใช้ `pymodbus` หรือ `node-opcua` แทน simulate mode
- แก้ `mqttService.js` → เชื่อมต่อ broker จริง
- เพิ่ม Modbus TCP Write/Read functions

### 2. เพิ่ม PLC/Machines ใหม่
- แก้ `plcs.json` + `machines.json`
- Dashboard จะแสดงอัตโนมัติ (ไม่ต้องแก้ code)

### 3. Persistent Storage
- เพิ่ม SQLite/PostgreSQL สำหรับเก็บ Command History
- เก็บ Machine State ลง database (ไม่ใช้ in-memory)

### 4. WebSocket Real-time
- แทนที่ polling ด้วย WebSocket
- แก้ `server.js` → เพิ่ม `ws` module
- Frontend: อัพเดท fetchStatus เป็น WebSocket listener

---

## 📝 เทคโนโลยีที่ใช้

### Backend
- **Node.js** + Express.js — REST API
- **Ollama** — AI LLM สำหรับ Command Parsing
- **UUID** — Machine/PLC identifiers

### Frontend
- **React 18** — UI Components
- **Vite** — Build tool + Dev server
- **CSS Variables** — Theme management

### Simulation (Mock)
- **plcSimulator.js** — PLC state simulation engine
- **machineState.js** — In-memory machine state management
- **gatewayService.js** — Gateway info + PLC summary API

---

## 📜 License

MIT License — ใช้สำหรับ prototype/ demonstration purposes

---

## ⚠️ ข้อจำกัด

1. **ข้อมูลทั้งหมดเป็น Simulation** — ไม่มี Hardware จริง
2. **State จะหายเมื่อ restart** — ใช้ in-memory (ไม่ persistent)
3. **ต้องติดตั้ง Ollama** — สำหรับ AI parsing (vocab-first fallback ไม่ต้องการ)
4. **MQTT ใน simulate mode** — ไม่ส่งคำสั่งไป broker จริง

---

*เอกสารนี้สร้างอัตโนมัติจาก Multi-PLC Architecture upgrade*