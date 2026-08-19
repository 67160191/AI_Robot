# Project Analysis & Fix Report

## 1. Project Overview
โปรเจกต์นี้เป็นระบบ **AI Robot Operator** สำหรับสั่งงานเครื่องจักรและ PLC ผ่าน Web Interface โดยผสานการทำงานของการสั่งคำสั่งแบบปกติ (Quick Buttons) เข้ากับการใช้ AI/LLM (Ollama) เพื่อแปลคำสั่งภาษาธรรมชาติให้กลายเป็นชุดคำสั่ง JSON ที่สามารถส่งต่อให้กับ Gateway, MQTT, และ Modbus TCP (Factory I/O Simulator) ได้

เป้าหมายหลักของโปรเจกต์คือการลดความซับซ้อนในการควบคุมเครื่องจักร โดยให้ผู้ปฏิบัติงานสามารถสั่งงานด้วยภาษาพูดได้

## 2. Current Architecture
ระบบแบ่งออกเป็น 4 ส่วนหลัก (Layers) อย่างชัดเจน:
- **Presentation Layer (Frontend):** React + Vite ทำหน้าที่รับคำสั่งจากผู้ใช้ ทั้งผ่านการพิมพ์ (ChatPanel) และปุ่มกด (ConveyorPanel)
- **Logic & AI Layer (Backend):** Node.js + Express เป็นศูนย์กลางในการประมวลผลคำสั่ง ใช้ `ollamaService.js` สำหรับแปลภาษา และ `vocabularyService.js` สำหรับเทียบคำสั่ง (Shortcut)
- **State & Integration Layer:**
  - `machineState.js`: เก็บสถานะ In-memory ของเครื่องจักรทั้งหมด
  - `mqttService.js`: ส่งต่อคำสั่งไปยัง MQTT Broker
- **Hardware Abstraction Layer (Gateway):** `factoryIoService.js` ทำหน้าที่แปลงคำสั่ง (Digital) ให้เป็น Modbus TCP (FC05 Write Single Coil) ไปยัง Factory I/O Simulator

**การจัดวาง:** ถือว่าแบ่ง Layer ได้ค่อนข้างเหมาะสมในระดับ Prototype มีการแยก Service ชัดเจน

## 3. Project Structure
**Frontend (`/frontend`)**
- `src/components/`: มีองค์ประกอบชัดเจน (`ConveyorPanel`, `ChatPanel`, `MachineStatus`) 
- `src/services/api.js`: แยกส่วนยิง API ออกมาเป็นสัดส่วน (Good Practice)

**Backend (`/backend`)**
- `routes/command.js`: ควบคุม Routing หลักของการประมวลผลคำสั่ง ทั้ง Parse, Execute และ Direct
- `services/`: 
  - `factoryIoService.js`: สื่อสารกับ Modbus
  - `mqttService.js`: สื่อสารกับ MQTT
  - `ollamaService.js`: สื่อสารกับ LLM
  - `vocabularyService.js`: จัดการเรื่อง Dictionary

**จุดที่พบการจัดวางที่ไม่เหมาะสม:**
- มีไฟล์ทดสอบ (Scratch / Test scripts) เช่น `test-modbus.js`, `check-coil.js` ปะปนอยู่ ควรมีโฟลเดอร์ `/tests` ชัดเจน
- ไม่มีการแยก Database Layer อย่างเป็นทางการ ทำให้ `machineState.js` และ `historyService.js` ต้องเก็บข้อมูลเป็น In-memory ซึ่งจะหายไปเมื่อระบบ Restart

## 4. System Data Flow
**Flow กรณีใช้ Chat Command (ผ่าน AI):**
1. User พิมพ์คำสั่ง -> Frontend ยิง POST `/api/command`
2. Backend (command.js) รับคำสั่ง ตรวจสอบ `vocabularyService` ก่อน
3. หากไม่เจอ จะเรียก `ollamaService` เพื่อแปลงประโยคเป็น JSON
4. Backend ตอบกลับให้ Frontend แสดงกล่องยืนยัน (Confirm)
5. User กดยืนยัน -> Frontend ยิง POST `/api/command/execute`
6. Backend บันทึกลง `machineState` และส่ง `mqttService`
7. Backend เรียก `factoryIoService.writeDeviceState()` เพื่อบันทึกลงตัวแปร
8. `factoryIoService` Cyclic Sync (ทุก 100ms) ส่งคำสั่ง FC05 Modbus ไปที่ Factory I/O
9. Factory I/O แสดงผลเครื่องจักรทำงาน

**Flow กรณีใช้ปุ่ม Quick Button:**
ข้ามขั้นตอนที่ 1-4 โดย Frontend จะยิง POST `/api/command/deviceId/start` ตรงไปที่ Backend ซึ่งจะวิ่งไปข้อ 6 ทันที

## 5. Problems Found

### Critical
- **[FIXED] Modbus Array Size Mismatch (FC15 vs FC5):** ก่อนหน้านี้ Backend พยายามเขียนสถานะ Coil รวม 7 ตัว (FC15) ไปยัง Factory I/O แต่ Factory I/O เปิดรับแค่ 3 Coils ทำให้โดน Reject คำสั่งทั้งหมด (Exception 02: Illegal Data Address) ส่งผลให้สายพานไม่หมุนเลย 
- **[FIXED] Chat Command execution missing Modbus Trigger:** เมื่อพิมพ์คำสั่งผ่านแชทและกดยืนยัน (Route `/execute`) โค้ดมีการอัปเดตแค่ In-memory state และ MQTT แต่ลืมเรียก `factoryIoService.writeDeviceState()` ทำให้ Modbus ไม่ได้รับคำสั่งนี้

### High
- **No Database Persistence:** ข้อมูลสถานะเครื่องจักรและประวัติการสั่งงานจะหายวับทันทีเมื่อ Server ดับหรือรีสตาร์ท (เช่น เมื่อ Nodemon ทำงาน)
- **Unprotected Endpoints:** ไม่มีระบบ Authentication ใครก็ตามที่เข้าถึง Network นี้ได้ สามารถยิง API ตรงเข้า `/api/command/execute` สั่งงาน PLC ได้เลย ซึ่งอันตรายมากในระดับ Factory

### Medium
- **Race Condition in Modbus Cyclic Sync:** การทำ setInterval ทุก 100ms ใน `factoryIoService.js` โดยไม่มีกลไกป้องกัน (Lock) อาจทำให้ Request ต่อคิวสะสมหาก Network หน่วง
- **MQTT Simulation Fallback:** ตัว MQTT ไม่มี Broker ที่เชื่อมต่อได้จริง ทำให้มันตกไปอยู่ในโหมด Simulate โดยปริยาย

### Low
- Error Handling ในบางจุดใช้ `try { ... } catch (e) {}` (Silent Fail) ทำให้ดีบักยาก

## 6. Bug Analysis

### Bug 1: พิมพ์คำสั่งแล้ว UI บอกเปิด แต่สายพานไม่หมุน (Chat Command Disconnect)
* **Problem:** เมื่อสั่งงานด้วยข้อความใน Chat Panel และกดยืนยัน ปุ่มขึ้นสถานะเปิด แต่เครื่องจักรใน Simulator นิ่ง
* **Cause:** ในไฟล์ `routes/command.js` Endpoint `/execute` ลืมเรียกคำสั่ง Sync ไปยัง Modbus 
* **Affected File:** `backend/routes/command.js`
* **Recommended Fix:** เพิ่มโค้ด `factoryIoService.writeDeviceState(device, true/false)` ลงใน Route `/execute` และ `/direct`
* **Example Fix:** 
```javascript
  if (action === "start" || action === "on") {
    factoryIoService.writeDeviceState(device, true);
  } else if (action === "stop" || action === "off") {
    factoryIoService.writeDeviceState(device, false);
  }
```
* **Testing Method:** พิมพ์ "เปิดสายพาน 1" ในแชท กดยืนยัน และสังเกตใน Factory I/O ว่าสายพานเคลื่อนที่

### Bug 2: ปุ่มกดแล้วสายพานไม่หมุน (Modbus FC15 Rejection)
* **Problem:** ก่อนหน้านี้ กดปุ่ม Quick button สายพานก็ไม่หมุน
* **Cause:** Factory I/O มี Coil รับสัญญาณแค่ 3 ตัว แต่โค้ดเก่าใช้ FC15 เขียนไป 7 ตัวพร้อมกัน ทำให้เกิด Exception 02
* **Affected File:** `backend/services/factoryIoService.js`
* **Recommended Fix:** เปลี่ยนจาก `writeCoils` เป็นการวนลูปใช้ `writeCoil` (FC5) ทีละตัว และครอบ `try..catch` เพื่อข้าม Coil ที่ไม่มีอยู่จริง ไม่ให้ลูปพัง
* **Testing Method:** รันสคริปต์ตรวจสอบค่า Coil ว่าถูกบันทึกสำเร็จหรือไม่

## 7. Architecture Improvements
- **แยก Data Layer ออกมา:** ปัจจุบัน State ถูกเก็บในตัวแปรธรรมดา (In-memory) ควรนำ **Redis** เข้ามาใช้เก็บ Machine State และ Queue เพื่อความคงทนและประสิทธิภาพที่ไวพอสำหรับ OT (Operational Technology)
- **เพิ่ม Message Broker ระหว่าง Backend กับ Gateway:** ตอนนี้ Backend (Express) ทำหน้าที่คุย Modbus ตรงๆ ควรแยก Service "Modbus Gateway" ออกเป็นอีก 1 Microservice ที่เขียนด้วย Python/Go หรือ Node ที่แยกต่างหาก แล้วสื่อสารกับ Backend ผ่าน MQTT เท่านั้น เพื่อให้ Backend สามารถ Scale ได้อิสระ
- **Command Validator:** เพิ่ม Validator Layer เพื่อตรวจเช็คว่า Parameter ที่ AI ปล่อยออกมา เช่น Temp: 1000, Speed: 9999 ไม่เกินค่าลิมิตจริงๆ (Safeguard)

## 8. Security Issues
- **ขาดการ Authentication (Critical):** ปัจจุบันไม่มี JWT หรือ Session ใดๆ ระบบ Industrial IoT **ต้องมี** Authorization ระดับ Role-based เพื่อแยกแยะวิศวกรกับพนักงาน
- **ไม่มี Rate Limiting:** การยิง API รัวๆ สามารถทำให้ LLM Service (Ollama) หรือ Modbus Gateway Overload ได้ ควรใส่ `express-rate-limit`
- **ไม่มีการทำ Data Sanitization:** คำสั่งที่ LLM ส่งกลับมา ควรมี JSON Schema Validation เสมอก่อนนำไปทำ `machineState.execute()`
- **Modbus Security:** Modbus TCP โดยพื้นฐานไม่มีการเข้ารหัส การนำไปใช้จริงควรอยู่ภายใต้ VPN หรือเครือข่ายจำเพาะทางวิศวกรรม (OT Network) เท่านั้น

## 9. How to Run the Project
1. **ติดตั้ง Dependencies:**
   - เข้าโฟลเดอร์ `backend` รัน `npm install`
   - เข้าโฟลเดอร์ `frontend` รัน `npm install`
2. **รันส่วนต่างๆ:**
   - **Ollama**: ต้องเปิดโปรแกรม Ollama และดึง Model ที่ต้องการ (เช่น `llama3.2`) รันไว้ที่พอร์ต 11434 
   - **Factory I/O**: เปิดโปรแกรม > ไปที่ File > Drivers > เลือก Modbus TCP/IP Server > กดเชื่อมต่อและตรวจสอบให้มั่นใจว่าไม่ได้กด Paused ไว้
   - **Backend**: ที่หน้าต่าง Terminal 1 (โฟลเดอร์ backend) รัน `npm run dev`
   - **Frontend**: ที่หน้าต่าง Terminal 2 (โฟลเดอร์ frontend) รัน `npm run dev`

## 10. How to Test the System
- **ทดสอบ Modbus Connection:** ดู Log ที่ Backend ว่าขึ้น `[Factory I/O] ✅ Connected! Starting 100ms cyclic sync.`
- **ทดสอบ Manual Command:** ไปที่เว็บ กดปุ่ม "เปิดสายพาน" ใน Conveyor Panel สายพานใน Simulator ต้องหมุน
- **ทดสอบ NLP (AI):** พิมพ์ "สั่งให้สายพานหยุดหน่อย" > กล่องจะแปลงคำสั่งเป็นหยุดสายพาน > กดยืนยัน > สายพานหยุด

## 11. Troubleshooting Guide
- **Frontend แจ้ง Error ECONNREFUSED:** แปลว่า Backend ล่ม หรือไม่ได้รัน หรือพอร์ต 3001 ชนกับโปรแกรมอื่น (ลองเช็ค `netstat -ano | findstr 3001` แล้ว kill process นั้นทิ้ง)
- **สายพานไม่หมุนแม้ขึ้นว่า Success:**
  - เช็คว่าในโปรแกรม Factory I/O กด Play (▶) แล้วหรือยัง
  - เช็คหน้า Driver (F4) ใน Factory I/O ว่าแถบซ้าย-ขวาผูกตรงกับ Coil 0-1 หรือไม่
- **AI ตอบช้า หรือแปลคำสั่งผิดบ่อย:** เช็คว่ารัน Ollama Server อยู่หรือไม่ หากเครื่องทำงานหนัก Model อาจดรอปสปีด

## 12. Recommended Development Order
1. **(High)** ทำ Backend API Security (JWT Auth & Role Based)
2. **(High)** เพิ่ม Safeguard Layer ป้องกันพารามิเตอร์แปลกๆ จาก AI
3. **(Medium)** นำ Redis มาใช้แทน In-memory state
4. **(Medium)** ปรับปรุง MQTT Integration ให้เชื่อมต่อจริง
5. **(Low)** แยก Modbus Gateway ออกเป็น Microservice อิสระ

## 13. Final Project Status
**ปัจจุบันโปรเจกต์อยู่ในระดับ:** `Prototype / พร้อมทดสอบกับ PLC Simulator`
สามารถนำไปใช้ Demo ประสิทธิภาพของ AI ในการแปลงภาษาให้เป็นคำสั่งควบคุมได้ดีมาก แต่ยัง**ไม่พร้อมสำหรับใช้งานในสภาพแวดล้อมทางอุตสาหกรรมจริง (Production Ready)** เนื่องจากขาดมาตรการด้าน Security ขั้นพื้นฐาน (Auth, Safeguard) และความทนทานของ State Management

## 14. Summary
ระบบ AI Robot Operator ถูกออกแบบมาเพื่อตอบโจทย์ Smart Factory แต่ในเรื่องของการนำไปเชื่อมต่อกับ OT (Operational Technology) ปัจจัยเรื่องความปลอดภัย (Security) การทำ Fail-safe และการแยกระบบเพื่อป้องกันการล่มเป็นลูกโซ่ ถือเป็นเรื่องสำคัญสูงสุด 
ณ ตอนนี้ บั๊กเกี่ยวกับการพิมพ์คำสั่ง และปัญหาสายพานไม่หมุน (Modbus FC15 Issue) ได้ถูกเคลียร์เรียบร้อยแล้ว ผู้ใช้สามารถใช้งาน Prototype ได้อย่างสมบูรณ์แบบ 100% ครับ
