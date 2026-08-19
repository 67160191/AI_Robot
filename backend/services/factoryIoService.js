// ============================================================
// AI Robot Operator - Factory I/O Modbus TCP Service
// ============================================================

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

// Factory I/O Modbus Server Settings
const FACTORY_IO_IP = process.env.FACTORY_IO_IP || '127.0.0.1';
const FACTORY_IO_PORT = 502;
const MODBUS_SLAVE_ID = 1;

let isConnected = false;
let reconnectTimer = null;
let syncInterval = null;

// ─── Default Coil Mapping ────────────────────────────────
const DEVICE_COIL_MAP = {
  'conveyor1': 0,
  'conveyor2': 1,
  'conveyor3': 2,
  'motor1':    3,
  'heater1':   4,
  'agv1':      5,
  'compressor1': 6
};

// เก็บ State ปัจจุบัน (In-memory)
const deviceStates = {};
Object.keys(DEVICE_COIL_MAP).forEach(k => deviceStates[k] = false);

// ─── Cyclic Sync (เหมือน PLC จริง) ────────────────────────
// จะส่งค่าไปให้ Factory I/O ตลอดเวลา ป้องกันปัญหา Timeout/Disconnect
const syncToFactoryIO = async () => {
  if (!isConnected) return;
  try {
    // 1. ส่งค่า Digital (Coils) - ใช้ FC5 (Write Single Coil) ทีละตัวตามที่ UI ระบุ
    for (const [dev, idx] of Object.entries(DEVICE_COIL_MAP)) {
      const state = deviceStates[dev] === true;
      try {
        await client.writeCoil(idx, state);
      } catch (err) {
        // fail silently for individual coil to prevent crashing if Factory I/O count < 7
        // console.warn(`[Factory I/O] Warning: Could not write coil ${idx}:`, err.message);
      }
    }

    // 2. ส่งค่า Analog (Holding Registers) 
    // เผื่อผู้ใช้เผลอใช้สายพานแบบ Analog (0-10V -> 0-1000)
    let registers = [];
    for (let i = 0; i < 7; i++) {
        let dev = Object.keys(DEVICE_COIL_MAP).find(key => DEVICE_COIL_MAP[key] === i);
        registers[i] = (dev && deviceStates[dev]) ? 1000 : 0;
    }
    try { await client.writeRegisters(0, registers); } catch(e) {}

  } catch (err) {
    console.error(`[Factory I/O] ❌ Sync Error:`, err.message);
    isConnected = false;
    if (syncInterval) clearInterval(syncInterval);
    reconnectTimer = setTimeout(connect, 2000);
  }
};

// ─── เชื่อมต่อ ──────────────────────────────────────────
const connect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (syncInterval) clearInterval(syncInterval);

  console.log(`[Factory I/O] 🔌 Connecting to Modbus TCP ${FACTORY_IO_IP}:${FACTORY_IO_PORT} ...`);
  try { client.close(); } catch (_) {}

  client.connectTCP(FACTORY_IO_IP, { port: FACTORY_IO_PORT })
    .then(() => {
      isConnected = true;
      client.setID(MODBUS_SLAVE_ID);
      console.log(`[Factory I/O] ✅ Connected! Starting 100ms cyclic sync.`);
      // เริ่มยิงข้อมูลทุกๆ 100ms แบบ PLC
      syncInterval = setInterval(syncToFactoryIO, 100);
    })
    .catch((err) => {
      isConnected = false;
      console.log(`[Factory I/O] ❌ Connection failed: ${err.message}. Retry in 5s...`);
      reconnectTimer = setTimeout(connect, 5000);
    });
};

// ─── เขียน Coil (Output) ─────────────────────────────────
const writeDeviceState = async (deviceId, state) => {
  if (DEVICE_COIL_MAP[deviceId] === undefined) return false;
  
  // อัพเดท In-memory state, เดี๋ยว Cyclic Sync จะดึงไปเขียนเอง
  deviceStates[deviceId] = state;
  console.log(`[Factory I/O] 🟢 Set [${deviceId}] → ${state ? 'ON' : 'OFF'}`);
  return true;
};

// ─── อ่านสถานะของเครื่องจักร ────────────────────────────
const getDeviceStatus = async (deviceId) => {
  let sensorInput0 = null;
  let sensorInput1 = null;

  if (isConnected) {
    try {
      const res = await client.readDiscreteInputs(0, 2);
      sensorInput0 = res.data[0];
      sensorInput1 = res.data[1];
    } catch(e) {}
  }
  
  return { 
    coilState: deviceStates[deviceId], 
    sensorInput0, 
    sensorInput1 
  };
};

const disconnect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (syncInterval) clearInterval(syncInterval);
  if (isConnected) {
    try { client.close(); } catch (_) {}
    isConnected = false;
    console.log(`[Factory I/O] 🛑 Disconnected.`);
  }
};

module.exports = {
  connect,
  disconnect,
  writeDeviceState,
  getDeviceStatus,
  isConnected: () => isConnected,
  getDeviceMap: () => DEVICE_COIL_MAP
};

