# 🤖 AI Robot Operator — Multi-PLC Simulation Prototype

ระบบควบคุมเครื่องจักรผ่าน AI Chat โดยไม่ต้องมี Hardware PLC จริง — ทำงานแบบ **Simulation/Dashboard** 100%

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|-----------|
| AI Command Parsing | ✅ | Ollama LLM แปลภาษาธรรมชาติเป็นคำสั่ง JSON |
| Vocab Matching (Fast Path) | ✅ | Match aliases ~0ms ไม่ต้องเรียก AI |
| Multi-PLC Architecture | ✅ | 3 PLC Stations, 12 Machines |
| Machine State Simulation | ✅ | อุณหภูมิ/Parameters อัพเดทอัตโนมัติ |
| Real-time Dashboard | ✅ | การ์ดเครื่องจักร 12 ตัว + PLC Summary Cards |
| Command Confirmation | ✅ | AI Parse → Confirm Dialog → Execute |
| Gateway Monitor | ✅ | Signal flow, Modbus Frame, Ladder Diagram, PLC Map |
| Vocabulary Manager | ✅ | เพิ่ม/ลบ aliases + custom commands |

## 🏭 Multi-PLC Configuration

### PLC Stations (3 ตัว)

| Station | Brand | Model | IP | Devices |
|---------|-------|-------|-----|---------|
| **PLC-01** | 🔴 Mitsubishi FX5U | FX5U-32MT/ESS | 192.168.1.20 | 5 machines |
| **PLC-02** | 🔵 Siemens S7-1200 | CPU 1214C | 192.168.1.21 | 2 machines |
| **PLC-03** | 🟢 Schneider Modicon | M221 | 192.168.1.22 | 5 machines |

### Machines (12 ตัว) พร้อม Parameters เฉพาะ

#### PLC-01 (Mitsubishi FX5U)
- **conveyor1** — สายพานลำเลียง 1 → `speed%, temp°C`
- **conveyor2** — สายพานลำเลียง 2 → `speed%, temp°C`
- **motor1** — มอเตอร์ขับเคลื่อนหลัก → `current(A), voltage(V)`
- **pump1** — ปั๊มน้ำหล่อเย็น → `speed%, temp°C`
- **fan1** — พัดลมระบายความร้อน → `coolingLevel, temp°C`

#### PLC-02 (Siemens S7-1200)
- **robot1** — หุ่นยนต์แขนกล → `position, gripper%`
- **agv1** — รถ AGV ลำเลียง → `battery(%), direction`

#### PLC-03 (Schneider M221)
- **heater1** — เตาอบ → `targetTemp°C`
- **compressor1** — ปั๊มลมแรงดันสูง → `pressure(PSI)`
- **crane1** — เครนยกสินค้า → `load(kg), height(m)`
- **light1** — ไฟสัญญาณเตือน → `color (off/red/yellow/green)`
- **chiller1** — เครื่องทำความเย็น → `speed%, temp°C`

---

## 🚀 การติดตั้งและใช้งาน

### ข้อกำหนดขั้นต่ำ
- Node.js 18+
- Ollama (สำหรับ AI parsing) — หรือไม่ก็ใช้ Vocab Matching ได้

### 1. ติดตั้ง Dependencies

```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install
```

### 2. ติดตั้ง Ollama (ถ้าต้องการ AI)

```bash
# ดาวน์โหลด: https://ollama.ai
# เปิด terminal แล้วรัน:
ollama pull llama3.2
```

### 3. รัน Application

```bash
# Terminal 1 — Backend
cd backend
npm start
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

---

## 📖 การใช้งาน

### 1. AI Chat Commands (ผ่าน Ollama)
พิมพ์ภาษาธรรมชาติในช่องแชท:
```
เปิดสายพาน 1 ความเร็ว 80
ปิดมอเตอร์หลัก
ตั้งอุณหภูมิเตาอบเป็น 150
เปิดทั้งหมด
status เครื่องจักรทุกตัว
```

### 2. Vocab Matching (ไม่ต้องใช้ AI)
aliases ที่มีอยู่แล้ว:
```
เปิด/เริ่ม/start → start
ปิด/หยุด/stop → stop
ความเร็ว/speed → set_speed
อุณหภูมิ/temp → set_target_temp
```

### 3. Quick Control Buttons
ใน Dashboard แต่ละเครื่องจักรมีปุ่ม:
- ▶ เปิด / ⏹ หยุด
- ↺ รีเซ็ต
- 🚨 E-Stop (เมื่อ running หรือ warning)

---

## 🔌 API Endpoints

### PLC Simulator APIs (ใหม่)
```
GET  /api/command/plc/status           → PLC summary (3 stations)
GET  /api/command/plc/telemetry/:plcId → PLC telemetry data
GET  /api/command/plc/devices/:deviceId → Device-to-PLC mapping
GET  /api/command/plc/mapping          → Full mapping object
```

### Command APIs
```
POST /api/command                      → AI parse (no execute)
POST /api/command/execute              → Execute with confirmation
POST /api/command/direct               → Quick control (no AI)
GET  /api/command/status               → All machines + MQTT + gateway
GET  /api/command/history              → Command history
GET  /api/command/models               → Available Ollama models
```

### Gateway APIs
```
GET  /api/command/gateway/status       → Gateway config + simPLCs
GET  /api/command/gateway/logs         → Event logs
GET  /api/command/gateway/explainer    → PLC languages reference
```

### Vocabulary APIs
```
GET    /api/command/vocab              → All vocab data
POST   /api/command/vocab/device       → Add device alias
POST   /api/command/vocab/action       → Add action alias
POST   /api/command/vocab/command      → Add custom command
DELETE /api/command/vocab/command/:id  → Delete custom command
DELETE /api/command/vocab/alias        → Delete alias (type + key)
```

---

## 🎨 Dashboard Components

### MachineStatus Panel
1. **PLC Summary Cards** — แสดง 3 การ์ด (สถานะทุก PLC)
2. **Summary Bar** — Running / Stopped / Warning / Error counts
3. **Machine Grid** — การ์ดเครื่องจักร 12 ตัว + real-time updates
4. **PlcInfoStrip** — Badge สถานะ PLC ของแต่ละเครื่อง

### Gateway Monitor
- **Tab: Monitor** — Signal flow, PLC status, Modbus frame, Ladder diagram
- **Tab: Network** — Topology, Protocol stack, Modbus function codes
- **Tab: PLC Map** — Machine-to-PLC mapping viewer (ค้นหาได้)

---

## 📊 Simulation Features

### Temperature Simulation
- Running → อุณหภูมิขึ้น ~0.5°C/3s
- Stopped → อุณหภูมิลง ~0.3°C/3s
- Warning เมื่อ temp > 80°C

### Multi-Parameter Simulation
แต่ละ machine parameters อัพเดทอัตโนมัติเมื่อ running:
```javascript
motor1.current     += random(0, 2) A    (max 30A)
motor1.voltage     = 380 + random(0, 5) V
agv1.battery       -= random(0, 0.1) %
heater1.targetTemp = speed × 1.8 °C
compressor1.pressure = speed × 1.2 PSI
```

---

## 🔧 การปรับแต่ง

### เพิ่ม Machine ใหม่ (ง่ายมาก — ไม่ต้องแก้ code)

1. เพิ่มใน `config/plcs.json`:
```json
{
  "id": "myMachine1",
  ...
}
```

2. เพิ่มใน `config/machines.json`:
```json
{
  "id": "myMachine1",
  "name": "เครื่องจักรใหม่",
  "plcId": "plc-main",
  "additionalParams": {
    "speed":     { "value": 0, "unit": "%" },
    "temperature": { "value": 0, "unit": "°C" }
  },
  ...
}
```

3. Restart backend → Dashboard แสดงอัตโนมัติ! ✅

---

## 🏗️ Architecture Diagram

```
┌─────────────┐     HTTP/REST      ┌──────────────┐
│   Frontend   │ ◄───────────────► │  Backend API  │
│   (React)    │                    │  (Express)    │
└─────────────┘                    └──────┬───────┘
     │                                     │
     │           3-second polling           ▼
     │                            ┌───────────────┐
     │                            │  Services      │
     │                            │  ├── machineState
     │                            │  ├── plcSimulator
     │                            │  ├── gatewayService
     │                            │  ├── ollamaService
     │                            │  └── vocabularyService
     │                            └───────┬───────┘
     ▼                                    │
┌─────────────┐                    Simulated
│  Dashboard   │ ◄──────────────────── PLC States
│  Real-time   │                        (12 Machines)
└─────────────┘
```

---

## 📁 โครงสร้างไฟล์สำคัญ

```
backend/
├── config/
│   ├── plcs.json              ← PLC configs (แก้ไขเพิ่มได้)
│   └── machines.json          ← Machine configs (แก้ไขเพิ่มได้)
├── services/
│   ├── plcSimulator.js        ← PLC simulation engine (ใหม่!)
│   ├── machineState.js        ← Multi-PLC state manager
│   ├── gatewayService.js      ← Gateway + PLC info API
│   └── ... (existing services)

frontend/src/
├── components/
│   ├── MachineStatus.jsx      ← Dashboard + PLC Summary Cards
│   ├── MachineStatus.css      ← PLC grid styles (ใหม่!)
│   ├── GatewayMonitor.jsx     ← Enhanced with Multi-PLC
│   └── ... (existing components)
└── services/
    └── api.js                 ← PLC endpoints (ใหม่!)
```

---

## ⚠️ ข้อจำกัดของ Prototype

| ข้อจำกัด | รายละเอียด |
|---------|-----------|
| ❌ ไม่มี Hardware จริง | ทุกอย่าง simulation |
| ❌ State จะหายเมื่อ restart | In-memory เท่านั้น |
| ⚠️ Ollama จำเป็น | สำหรับ AI (vocab-first ไม่ต้องการ) |
| ⚠️ MQTT simulate mode | ไม่ได้ส่งไป broker จริง |

---

## 🔮 Next Steps (พัฒนาต่อ)

1. **เชื่อมต่อ PLC จริง** → ใช้ `pymodbus` หรือ `node-opcua`
2. **Persistent Storage** → SQLite/PostgreSQL สำหรับ history
3. **WebSocket Real-time** → แทนที่ 3s polling
4. **เพิ่ม Multi-PLC ได้ไม่จำกัด** → แก้ config เท่านั้น

---

## 📄 License

MIT — สำหรับ prototype/demonstration purposes