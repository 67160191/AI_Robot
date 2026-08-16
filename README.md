# AI Robot Operator - Multi-PLC Simulation Prototype

ระบบควบคุมเครื่องจักรผ่าน AI Chat โดยไม่ต้องมี Hardware PLC จริง ทำงานแบบ Simulation/Dashboard 100%

---

## ภาพรวมโปรเจค (Project Overview)

โปรเจคนี้คือ Simulation/Dashboard-only prototype ที่จำลองการทำงานของระบบควบคุมเครื่องจักรผ่าน AI โดยไม่ต้องมี Hardware PLC จริง

สิ่งที่ทำงานได้จริงใน Simulation:
- AI Command Parsing ผ่าน Ollama LLM
- Vocab Matching (Fast Path, Response ~0ms)
- Machine State Management แบบ In-Memory
- Temperature/Parameter Simulation (อัพเดทค่าแบบ Real-time)
- Multi-PLC Architecture (จำลอง 3 PLCs, 12 Machines)
- Dashboard Real-time Updates 
- Command History และ Confirmation Flow
- Vocabulary Manager สำหรับจัดการคำสั่งและคำพ้องความหมาย
- PLC Simulator และ Gateway Monitor

สิ่งที่ทำงานแบบ Simulation เท่านั้น (ไม่มี Hardware จริง):
- MQTT Publishing (แสดงเพียง payload ที่ "จะถูกส่ง")
- PLC Modbus TCP Write/Read (มีข้อมูล Mapping ครบ แต่ไม่มีการสื่อสารจริงกับอุปกรณ์)
- Machine Feedback (จำลองพฤติกรรมอุณหภูมิขึ้น/ลง อัตโนมัติในหน่วยความจำ)

---

## Multi-PLC Configuration

ระบบได้ถูกตั้งค่าให้มี PLC 3 สถานี และ เครื่องจักร 12 เครื่อง 

### PLC Stations (3 สถานี)

| สถานี | ชื่อกลุ่ม | ยี่ห้อ | รุ่น | IP Address | จำนวนเครื่องจักร |
|---------|------|-------|-------|-----|---------|
| PLC-01 | Main Assembly Line | Mitsubishi FX5U | FX5U-32MT/ESS | 192.168.1.20 | 5 |
| PLC-02 | Robot & AGV Cell | Siemens S7-1200 | CPU 1214C | 192.168.1.21 | 2 |
| PLC-03 | Utility & Environmental | Schneider Modicon | M221 | 192.168.1.22 | 5 |

### Machines (12 เครื่องจักร)

#### PLC-01 (Mitsubishi FX5U)
- conveyor1: สายพานลำเลียง 1 (Parameters: speed%, temp)
- conveyor2: สายพานลำเลียง 2 (Parameters: speed%, temp)
- motor1: มอเตอร์ขับเคลื่อนหลัก (Parameters: current(A), voltage(V))
- pump1: ปั๊มน้ำหล่อเย็น (Parameters: speed%, temp)
- fan1: พัดลมระบายความร้อน (Parameters: coolingLevel, temp)

#### PLC-02 (Siemens S7-1200)
- robot1: หุ่นยนต์แขนกลประกอบชิ้นส่วน (Parameters: position, gripper%)
- agv1: รถ AGV ลำเลียง (Parameters: battery(%), direction)

#### PLC-03 (Schneider M221)
- heater1: เตาอบอบชิ้นส่วน (Parameters: targetTemp)
- compressor1: ปั๊มลมแรงดันสูง (Parameters: pressure(PSI))
- crane1: เครนยกสินค้า (Parameters: load(kg), height(m))
- light1: ไฟสัญญาณเตือน (Parameters: color - off/red/yellow/green)
- chiller1: เครื่องทำความเย็นหลัก (Parameters: speed%, temp)

---

## สถาปัตยกรรมระบบ (Architecture)

การทำงานของระบบถูกแบ่งเป็นฝั่ง Frontend (React) และ Backend API (Express) 

```text
[Frontend] <---(HTTP/REST/Polling)---> [Backend API]
                                            |
                                       [Services] (machineState, plcSimulator, gatewayService, ollamaService)
                                            |
                                  [Simulated PLC States] (12 Machines / 3 Stations)
```

### กระแสข้อมูลจำลอง (Simulation Data Flow)
- plcSimulator.js เป็นเอนจินจำลองการทำงาน สร้าง PLC state แบบ in-memory และจัดการข้อมูล Telemetry
- machineState.js เป็นตัวจัดการ state หลัก รับผิดชอบเรื่องการอัพเดทค่าและจำลองอุณหภูมิ (อัพเดททุก 3 วินาที)
- ข้อมูลจำลองทั้งหมดจะถูกดึงไปแสดงผลบน Dashboard แบบ Real-time ผ่านการ Polling

---

## ฟีเจอร์ที่น่าสนใจ

### ระบบประมวลผลคำสั่ง (AI Command Parsing Flow)
ผู้ใช้สามารถพิมพ์คำสั่งในรูปแบบภาษาธรรมชาติ เช่น "เปิดสายพาน 1 ความเร็ว 80"
1. Frontend ส่งคำสั่งผ่าน POST /api/command 
2. ระบบจะพยายามจับคู่กับ Vocab Service ก่อน (Fast path) 
3. หากไม่พบ จะส่งคำสั่งไปให้ Ollama LLM ประมวลผลและแปลงเป็น JSON
4. ส่งข้อมูลกลับให้ Frontend แสดง Confirm Dialog ให้ผู้ใช้ยืนยัน
5. เมื่อยืนยัน ระบบจะปรับเปลี่ยน State และอัพเดทไปยัง PLC Simulator

### Dashboard 
- MachineStatus Panel: แสดงการ์ดสรุปสถานะของทั้ง 3 PLC Station พร้อมแสดงการ์ดเครื่องจักรทั้ง 12 ตัว สีของการ์ดจะสอดคล้องกับ PLC Station ที่สังกัดอยู่
- Gateway Monitor: หน้าต่างสำหรับมอนิเตอร์ Signal Flow, Modbus Frame, และ Network Topology รวมถึงมีเครื่องมือดู Machine-to-PLC Mapping
- Quick Control Buttons: ทุกเครื่องจักรจะมีปุ่มให้สามารถ เปิด/หยุด/รีเซ็ต หรือ E-Stop ได้ทันทีโดยไม่ต้องผ่าน AI

---

## โครงสร้างไฟล์และโฟลเดอร์

```text
backend/
├── config/           (plcs.json และ machines.json สำหรับตั้งค่าระบบ)
├── services/         (บริการต่างๆ เช่น plcSimulator.js, machineState.js, gatewayService.js)
├── routes/           (API Endpoints ทั้งหมด)
└── server.js         (Express server entry point)

frontend/src/
├── components/       (UI Components เช่น MachineStatus, GatewayMonitor, ChatPanel)
├── services/         (API client)
└── App.jsx           (Main app layout)
```

---

## API Endpoints หลัก

PLC Simulator APIs:
- GET /api/command/plc/status - ข้อมูลสรุปของ 3 PLC stations
- GET /api/command/plc/telemetry/:plcId - ข้อมูล Telemetry เชิงลึกของ PLC
- GET /api/command/plc/devices/:deviceId - ข้อมูลอ้างอิง Device-to-PLC
- GET /api/command/plc/mapping - สรุป Mapping ทั้งหมดในระบบ

Command APIs:
- POST /api/command - ส่งคำสั่งให้ AI ประมวลผลเป็น JSON
- POST /api/command/execute - ยืนยันการสั่งการเครื่องจักร
- POST /api/command/direct - สั่งการเครื่องจักรโดยตรงผ่านปุ่มบน UI (ไม่ผ่าน AI)
- GET /api/command/status - ตรวจสอบสถานะเครื่องจักรทั้งหมด

Gateway APIs:
- GET /api/command/gateway/status - สถานะการทำงานของ Gateway
- GET /api/command/gateway/logs - บันทึก Event logs ต่างๆ

Vocabulary APIs:
- GET /api/command/vocab - ดึงข้อมูลคำพ้องทั้งหมด
- POST /api/command/vocab/... - เพิ่มข้อมูลคำสั่งและคำพ้อง

---

## การติดตั้งและเริ่มใช้งาน

ข้อกำหนดขั้นต่ำ:
- Node.js 18+
- Ollama (สำหรับ AI Parsing, ถ้าไม่ใช้จะมีเพียง Vocab Matching)

1. ติดตั้ง Dependencies:
สำหรับ Backend:
```bash
cd backend
npm install
```

สำหรับ Frontend:
```bash
cd frontend
npm install
```

2. ติดตั้งและดึงข้อมูลโมเดล Ollama (หากต้องการใช้งาน AI Parsing):
```bash
ollama pull llama3.2
```

3. เริ่มการทำงาน:
เปิด Terminal ที่ 1 สำหรับ Backend:
```bash
cd backend
npm start
```
(เซิร์ฟเวอร์จะเปิดที่พอร์ต 3001)

เปิด Terminal ที่ 2 สำหรับ Frontend:
```bash
cd frontend
npm run dev
```
(แอปพลิเคชันจะเปิดที่พอร์ต 5173 สามารถเข้าผ่านเบราว์เซอร์ได้ที่ http://localhost:5173)

---

## การปรับแต่งระบบเพิ่มเติม

ระบบถูกออกแบบให้สามารถปรับแต่งได้ง่ายโดยไม่ต้องแก้โค้ดลอจิก:
1. การเพิ่มเครื่องจักรใหม่: สามารถเพิ่ม Device เข้าไปในไฟล์ `backend/config/plcs.json` และกำหนดพารามิเตอร์ใน `backend/config/machines.json`
2. การปรับเปลี่ยนพารามิเตอร์: เข้าไปแก้ไขได้ที่ฟิลด์ `additionalParams` ของเครื่องจักรแต่ละตัวในไฟล์ config จากนั้นให้เริ่มต้นระบบ Backend ใหม่

---

## เทคโนโลยีที่ใช้งาน

- Backend: Node.js, Express.js, Ollama, UUID
- Frontend: React 18, Vite, CSS Variables

---

## ข้อจำกัดของ Prototype รุ่นปัจจุบัน

- ข้อมูลทั้งหมดเป็นการจำลอง ไม่มี Hardware หรือการส่งสัญญาณออกไปจริง
- เนื่องจากใช้แบบ In-memory สถานะและการเปลี่ยนแปลงทั้งหมดจะสูญหายหากมีการรีสตาร์ทแอปพลิเคชัน
- หากต้องการฟีเจอร์แปลภาษาธรรมชาติให้เป็น JSON อย่างสมบูรณ์ ต้องติดตั้ง Ollama เป็นเซอร์วิสภายนอก
- MQTT ทำงานอยู่ในโหมดจำลอง ไม่มีการส่งข้อความไปยัง Broker จริง

---

## แนวทางการพัฒนาต่อในอนาคต

- เชื่อมต่อกับอุปกรณ์ฮาร์ดแวร์จริง เช่น การใช้งานไลบรารี `pymodbus` หรือ `node-opcua`
- จัดเก็บข้อมูลใน Persistent Storage เช่น SQLite หรือ PostgreSQL สำหรับเก็บบันทึกคำสั่งและสถานะย้อนหลัง
- อัพเกรดการดึงข้อมูลจากเดิมที่เป็นแบบ Polling ทุก 3 วินาทีไปใช้งาน WebSocket แบบ Real-time
- รองรับการเชื่อมต่อกับ PLC หลากหลายรุ่นเพิ่มเติมนอกเหนือจากที่จำลองไว้

---

## การอนุญาต (License)

MIT License - เหมาะสำหรับใช้งานเป็นต้นแบบและศึกษาทดลอง