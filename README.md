# AI Robot Operator 🤖

ระบบควบคุมเครื่องจักรอัจฉริยะด้วย AI - Full Stack Prototype

## 🏗️ Architecture

```
React + Vite (Frontend)
       ↓ HTTP /api/*
Node.js Express (Backend)
       ↓ Ollama API
Ollama (AI Engine) ← http://localhost:11434
       ↓ MQTT Publish
MQTT Broker (mqtt://localhost:1883)
       ↓ Subscribe
Raspberry Pi / PLC Gateway
```

## 📁 Structure

```
Ai_Robot/
├── backend/
│   ├── server.js              ← Express entry point
│   ├── routes/
│   │   └── command.js         ← API routes
│   ├── services/
│   │   ├── ollamaService.js   ← AI parsing
│   │   ├── mqttService.js     ← PLC communication
│   │   ├── machineState.js    ← Machine simulator
│   │   └── historyService.js  ← Command history
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ChatPanel.jsx       ← AI Chat
    │   │   ├── MachineStatus.jsx   ← Dashboard
    │   │   ├── CommandHistory.jsx  ← Logs
    │   │   └── OllamaStatus.jsx    ← AI Status
    │   ├── services/api.js
    │   ├── App.jsx
    │   └── index.css
    └── vite.config.js
```

## 🚀 Getting Started

### 1. Start Backend
```bash
cd backend
npm run dev
# หรือ
node server.js
```
Backend จะ run ที่ http://localhost:3001

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Frontend จะ run ที่ http://localhost:5173

### 3. Ollama ต้องรันอยู่
```bash
ollama serve
# ตรวจสอบ models
ollama list
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/command | ส่งคำสั่งภาษาไทยไปให้ AI แปล |
| POST | /api/command/direct | สั่งตรงโดยไม่ผ่าน AI |
| GET | /api/command/status | สถานะเครื่องจักรทั้งหมด |
| GET | /api/command/history | ประวัติคำสั่ง |
| GET | /api/command/models | Models ใน Ollama |

### Example Request
```bash
curl -X POST http://localhost:3001/api/command \
  -H "Content-Type: application/json" \
  -d '{"message": "เปิดสายพาน 1"}'
```

## 🤖 Supported Devices

| ID | ชื่อ |
|----|------|
| conveyor1 | สายพาน 1 |
| conveyor2 | สายพาน 2 |
| motor1 | มอเตอร์หลัก |
| pump1 | ปั๊มน้ำหล่อเย็น |
| fan1 | พัดลมระบายความร้อน |
| robot1 | หุ่นยนต์แขนกล |

## ⚙️ Actions

| Action | Description |
|--------|-------------|
| start / on | เปิดใช้งาน |
| stop / off | หยุด |
| set_speed | ตั้งความเร็ว (params.speed: 0-100) |
| emergency_stop | หยุดฉุกเฉิน |
| reset | รีเซ็ต |

## 📡 MQTT Topics

| Topic | Description |
|-------|-------------|
| factory/command | คำสั่งจาก Backend → Pi |
| factory/status | สถานะจาก Pi → Backend |

### Payload Format
```json
{
  "device": "conveyor1",
  "action": "start",
  "params": { "speed": 60 },
  "timestamp": "2025-01-01T00:00:00.000Z",
  "source": "ai-operator"
}
```

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Backend port |
| MQTT_BROKER | mqtt://localhost:1883 | MQTT broker URL |

## 📦 Next Steps (Production)

1. เปลี่ยน In-Memory state เป็น MongoDB/PostgreSQL
2. เพิ่ม Authentication (JWT)
3. ติดตั้ง MQTT Broker จริง (Mosquitto บน Pi)
4. ต่อกับ PLC ผ่าน Modbus TCP หรือ OPC UA
5. เพิ่ม WebSocket สำหรับ real-time updates
