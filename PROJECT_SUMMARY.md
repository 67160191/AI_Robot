# AI Robot Operator - Multi-PLC Simulation Prototype

## ภาพรวมของโครงการ (Project Overview)

โปรเจคนี้คือ Simulation/Dashboard-only prototype ที่จำลองการทำงานของระบบควบคุมเครื่องจักรผ่าน AI โดยไม่ต้องมี Hardware PLC จริง

### สิ่งที่ทำให้ทำงานได้ (Simulation Capabilities)
- AI Command Parsing ผ่านระบบ Ollama LLM
- Vocab Matching (Fast Path, ใช้เวลาตอบสนองประมาณ 0ms)
- Machine State Management (ทำงานผ่าน In-Memory)
- Temperature และ Parameter Simulation
- สถาปัตยกรรม Multi-PLC (จำลองระบบด้วย 3 PLCs และ 12 Machines)
- Dashboard Real-time Updates เพื่อการแสดงผลที่ทันเวลา
- Command History พร้อมกับ Confirmation Flow 
- Vocabulary Manager สำหรับจัดการคำสั่งต่างๆ
- PLC Simulator และ Gateway Monitor
- การเชื่อมต่อ Factory I/O ผ่าน Modbus TCP แบบทำงานได้จริง
- Web Audio API สำหรับ Sound Effects ใน Chat UI

### สิ่งที่จำลองสถานการณ์เท่านั้น (Simulation Without Hardware)
- MQTT Publishing (แสดงเฉพาะ payload ที่จำลองว่าจะส่งออกไป)
- PLC Modbus TCP (ส่วนของการสื่อสารกับฮาร์ดแวร์จริงยังเป็นการจำลอง แต่สามารถเชื่อมต่อกับ Factory I/O 3D Simulator ได้แล้ว)
- Machine Feedback (จำลองสถานการณ์อุณหภูมิขึ้นหรือลงแบบอัตโนมัติ)

---

## สถาปัตยกรรมระบบ (Architecture)

```text
[Frontend] <---(HTTP/REST/Polling)---> [Backend API]
                                            |
                                       [Services] (machineState, plcSimulator, gatewayService, ollamaService)
                                            |
                                  [Simulated PLC States] (12 Machines / 3 Stations)
```

---

## การตั้งค่า Multi-PLC Configuration

### สถานี PLC (PLC Stations) จำนวน 3 ชุด

| สถานี | ชื่อกลุ่มการทำงาน | ยี่ห้อ | รุ่น | IP Address | จำนวนอุปกรณ์ |
|---------|------|-------|-------|-----|---------|
| PLC-01 | Main Assembly Line | Mitsubishi FX5U | FX5U-32MT/ESS | 192.168.1.20 | 5 เครื่อง |
| PLC-02 | Robot & AGV Cell | Siemens S7-1200 | CPU 1214C | 192.168.1.21 | 2 เครื่อง |
| PLC-03 | Utility & Environmental | Schneider Modicon | M221 | 192.168.1.22 | 5 เครื่อง |

### เครื่องจักรทั้งหมด 12 ตัว (รองรับ Multi-PLC)

#### PLC-01 Devices (Mitsubishi FX5U)
- conveyor1: สายพานลำเลียง 1 (พารามิเตอร์เพิ่มเติม: speed, temp)
- conveyor2: สายพานลำเลียง 2 (พารามิเตอร์เพิ่มเติม: speed, temp)
- motor1: มอเตอร์ขับเคลื่อนหลัก (พารามิเตอร์เพิ่มเติม: current (A), voltage (V))
- pump1: ปั๊มน้ำหล่อเย็น (พารามิเตอร์เพิ่มเติม: speed, temp)
- fan1: พัดลมระบายความร้อน (พารามิเตอร์เพิ่มเติม: coolingLevel, temp)

#### PLC-02 Devices (Siemens S7-1200)
- robot1: หุ่นยนต์แขนกลประกอบชิ้นส่วน (พารามิเตอร์เพิ่มเติม: position, gripper)
- agv1: รถ AGV ลำเลียง (พารามิเตอร์เพิ่มเติม: battery (%), direction)

#### PLC-03 Devices (Schneider M221)
- heater1: เตาอบอบชิ้นส่วน (พารามิเตอร์เพิ่มเติม: targetTemp (°C))
- compressor1: ปั๊มลมแรงดันสูง (พารามิเตอร์เพิ่มเติม: pressure (PSI))
- crane1: เครนยกสินค้า (พารามิเตอร์เพิ่มเติม: load (kg), height (m))
- light1: ไฟสัญญาณเตือน (พารามิเตอร์เพิ่มเติม: color (on/off/red/yellow/green))
- chiller1: เครื่องทำความเย็นหลัก (พารามิเตอร์เพิ่มเติม: speed, temp)

---

## โครงสร้างไฟล์ (File Structure)

### Backend Config
- backend/config/plcs.json: นิยาม PLC Station ทั้ง 3 ชุด
- backend/config/machines.json: นิยาม Machine พร้อม parameter (12 ชุด)
- backend/services/factoryIoService.js: บริการเชื่อมต่อ Modbus TCP ไปยัง Factory I/O
- backend/services/plcSimulator.js: เอนจินจำลองการทำงานของ PLC
- backend/services/machineState.js: ตัวจัดการ State และ Multi-PLC sync
- backend/services/gatewayService.js: Gateway และ PLC info API
- backend/services/ollamaService.js: ตัวจัดการ AI Command Parsing
- backend/services/vocabularyService.js: จัดการ Alias Matching
- backend/services/mqttService.js: จำลองสถานการณ์ MQTT
- backend/services/historyService.js: บันทึก Command History
- backend/routes/command.js: API endpoints และ PLC simulator APIs
- backend/server.js: จุดเริ่มต้นของ Express server

### Frontend Components
- frontend/src/components/MachineStatus.jsx: Dashboard หลัก และ PLC Summary Cards
- frontend/src/components/MachineStatus.css: สไตล์ของ PLC grid
- frontend/src/components/GatewayMonitor.jsx: หน้าต่าง PLC Mapping Tab
- frontend/src/components/ChatPanel.jsx: อินเตอร์เฟสสำหรับ AI Chat
- frontend/src/components/CommandHistory.jsx: บันทึกการสั่งการ
- frontend/src/components/VocabPanel.jsx: จัดการคำพ้อง (Vocabulary manager)
- frontend/src/services/api.js: API client และ PLC endpoints
- frontend/src/App.jsx: โครงร่างหน้าหลักของระบบ

---

## New API Endpoints สำหรับ Multi-PLC

### PLC Status และ Telemetry
- GET /api/command/plc/status: ดูภาพรวม PLC (3 สถานี)
- GET /api/command/plc/telemetry/:plcId: ดู telemetry เฉพาะเจาะจงของ PLC
- GET /api/command/plc/devices/:deviceId: ดูข้อมูล Device-to-PLC
- GET /api/command/plc/mapping: ดู mapping เต็มรูปแบบระหว่าง Device และ PLC

### Existing Endpoints
- GET /api/command/gateway/status: ดูข้อมูลของ Gateway และ simPLCs
- GET /api/command/gateway/logs: Event logs ต่างๆ
- GET /api/command/gateway/explainer: Reference สำหรับภาษาของ PLC
- GET /api/command/status: สถานะทั้งหมดของเครื่องจักร MQTT และ gateway
- GET /api/command/history: ประวัติการสั่งการ
- GET /api/command/models: โมเดล Ollama ที่พร้อมใช้งาน
- POST /api/command: ให้ AI ประมวลผล (ไม่มีการ execute)
- POST /api/command/execute: execute คำสั่งที่ได้รับการยืนยัน
- POST /api/command/direct: ควบคุมแบบเร่งด่วน (ไม่ใช้ AI)

---

## Dashboard Features สำหรับ Multi-PLC

### อัปเดตคอมโพเนนต์ MachineStatus
1. PLC Summary Cards (แถบบนสุด)
   - แสดง 3 การ์ดแยกตาม PLC แต่ละชุด
   - ระบุชื่อยี่ห้อให้ชัดเจน (Mitsubishi, Siemens, Schneider)
   - แสดงจำนวน Device, อุปกรณ์ออนไลน์, เวลาที่ออนไลน์ (Uptime)
   - แสดงการแจ้งเตือน Error

2. Machine Cards (ตารางกริด 12 เครื่องจักร)
   - แต่ละการ์ดระบุป้ายของ PLC Station ไว้อย่างชัดเจน
   - มี Info Strip แสดง IP, Coil Address และ Terminal Info
   - สีของป้ายแยกระบุตามต้นทางของสถานี PLC เพื่อการแยกแยะที่ง่ายขึ้น

### อัปเดตคอมโพเนนต์ GatewayMonitor
- Tab 1 Monitor: ดู Signal flow, สถานะ PLC และ Event logs
- Tab 2 Network: ดู Topology diagram, Protocol stack และ Modbus reference
- Tab 3 PLC Map: หน้าต่าง Machine-to-PLC mapping ที่ปรับให้รองรับโครงสร้างแบบ Multi-PLC

---

## การติดตั้งและการใช้งาน (Setup and Usage)

1. ติดตั้ง Dependencies ในส่วน Backend และ Frontend
2. ติดตั้ง Ollama AI Model (เช่น llama3.2)
3. รัน Application ทั้งส่วน Backend (พอร์ต 3001) และ Frontend (พอร์ต 5173)
4. เปิดเบราว์เซอร์ไปที่ http://localhost:5173 เพื่อดู Dashboard เครื่องจักร 12 เครื่องผ่านระบบ 3 PLC stations

---

## ระบบจำลองที่ทำงานได้จริง (Functional Simulations)

### AI Command Parsing Flow
1. ผู้ใช้พิมพ์คำสั่งผ่าน Chat
2. ระบบจะเทียบคำด้วย Vocab Service ก่อน
3. หากไม่พบ จะส่งไปให้ระบบ AI แบบ LLM เป็นผู้ประมวลผลแทน เพื่อเปลี่ยนคำสั่งเป็น JSON
4. ยืนยันคำสั่งผ่าน Confirm Dialog ก่อนจะไปสู่ Dashboard ต่อ

### Temperature Simulation
ระบบจำลองอุณหภูมิที่ปรับเปลี่ยนแบบ Real-time โดยจะเพิ่มขึ้นเมื่ออยู่ในสถานะ Running และจะลดลงเมื่อเปลี่ยนเป็น Stopped หากอุณหภูมิพุ่งสูงเกินกำหนดสถานะการแจ้งเตือนจะเปลี่ยนเป็น Warning ทันที

### Multi-Parameter Support
พารามิเตอร์จะแตกต่างกันไปตามชนิดของเครื่องจักร ตัวอย่างเช่น
- มอเตอร์ (motor1): กำหนดการเปลี่ยนแปลงของกระแส (current) และแรงดันไฟฟ้า (voltage)
- รถ AGV (agv1): ระบบพลังงานแบตเตอรี่จะลดลง
- ฮีทเตอร์ (heater1) และ ปั๊มลม (compressor1): จำลองเป้าหมายความร้อนและความดันผ่านความเร็วเครื่อง

---

## การปรับแต่งระบบ (System Configuration)

### เพิ่มเครื่องจักรใหม่ (Add new Machine)
เพิ่มชุดคำสั่งผ่าน backend/config/plcs.json ให้เพิ่มตัวแปรเข้าไปใน devices array และ เพิ่มพารามิเตอร์การตั้งค่าผ่าน backend/config/machines.json

### เปลี่ยนตั้งค่าระบบ หรือ PLC IP (Update IP Config)
ทำการแก้ข้อมูลในไฟล์ backend/config/plcs.json

---

## แนวทางการพัฒนาต่อในอนาคต (Next Steps)

1. การเชื่อมต่อสู่ฮาร์ดแวร์ PLC ของจริงอย่างเต็มรูปแบบ หลังจากที่ทดสอบกับ Factory I/O ผ่าน modbus-serial สำเร็จแล้ว
2. รองรับจำนวนของ PLC และ Machines ที่เพิ่มเข้ามาได้ เพียงแค่ตั้งค่าปรับในคอนฟิก
3. จัดเก็บข้อมูลให้อยู่คงถาวร ผ่านการเรียกใช้ระบบอย่าง SQLite หรือ PostgreSQL เพื่อสำรองระบบการสั่งการและประวัติ
4. การรันแบบ Real-time เต็มตัว ผ่านตัวเชื่อมการสื่อสารแบบ WebSocket แทนที่การทำระบบแบบ Polling แบบเดิม

---

## เทคโนโลยีที่เลือกใช้ (Technologies Used)

### ฝั่ง Backend
- Node.js และ Express.js
- Ollama
- UUID
- Modbus TCP (modbus-serial)

### ฝั่ง Frontend
- React 18
- Vite
- CSS Variables

### ระบบ Simulation (Mock)
- plcSimulator.js (ระบบจำลอง)
- machineState.js (In-memory จัดเก็บสถานะ)
- gatewayService.js (ส่วนเชื่อมข้อมูลและ API สรุปยอด)

---

## ลิขสิทธิ์ระบบ (License)
ระบบนี้อยู่ภายใต้ MIT License โดยเหมาะสำหรับการใช้งานเป็นต้นแบบและศึกษาทดลอง

---

## ข้อจำกัดของต้นแบบ (Prototype Limitations)
1. การเชื่อมต่อกับ Hardware PLC ของจริงยังไม่มี (ทดแทนด้วย Factory I/O Simulator)
2. ไม่จัดเก็บข้อมูลอย่างถาวร หากมีการรีสตาร์ทระบบ State ทั้งหมดจะหายไป
3. ความจำเป็นในการประมวลผลคำสั่งด้วยภาษาธรรมชาติผ่านระบบ AI แบบ LLM (แต่จะยังมีคำสั่งเฉพาะที่อ้างอิงกับตัวพจนานุกรมรองรับอยู่)
4. MQTT ระบบนี้ใช้เพียงจำลองข้อความ ไม่ได้มีการส่งเข้า broker ในระบบจริง

*เอกสารนี้ได้รับการปรับปรุงให้รองรับกับการใช้งานร่วมกับ Factory I/O และ Multi-PLC Architecture โดยสมบูรณ์*