// ============================================================
// AI Robot Operator - Factory I/O Modbus TCP Service
// ============================================================

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

// Factory I/O Modbus Server Settings
const FACTORY_IO_IP = process.env.FACTORY_IO_IP || '127.0.0.1';
const FACTORY_IO_PORT = 502;

let isConnected = false;

// ─── Default Coil Mapping ────────────────────────────────
// แมปชื่อ Device ID กับตำแหน่ง Coil (Output) ใน Factory I/O
// คุณสามารถแก้ Coil Address ตรงนี้ให้ตรงกับ Scene ใน Factory I/O ได้
const DEVICE_COIL_MAP = {
  'conveyor1': 0,
  'conveyor2': 1,
  'conveyor3': 2,
  'motor1': 3,
  'heater1': 4,
  'agv1': 5,
  'compressor1': 6
};

/**
 * เชื่อมต่อไปยัง Factory I/O Modbus Server
 */
const connect = () => {
  console.log(`[Factory I/O] Attempting to connect to Modbus TCP at ${FACTORY_IO_IP}:${FACTORY_IO_PORT}...`);
  
  client.connectTCP(FACTORY_IO_IP, { port: FACTORY_IO_PORT })
    .then(() => {
      isConnected = true;
      client.setID(1); // Default Modbus Unit ID
      console.log(`[Factory I/O] ✅ Connected successfully!`);
    })
    .catch((err) => {
      isConnected = false;
      console.log(`[Factory I/O] ❌ Connection failed: ${err.message}. Retrying in 5s...`);
      setTimeout(connect, 5000);
    });
};

/**
 * ควบคุมสถานะเครื่องจักรใน Factory I/O
 * @param {string} deviceId - เช่น 'conveyor1'
 * @param {boolean} state - true (เปิด) / false (ปิด)
 */
const writeDeviceState = async (deviceId, state) => {
  if (!isConnected) {
    console.log(`[Factory I/O] ⚠️ Not connected. Skipped command for ${deviceId}`);
    return false;
  }

  const coilAddress = DEVICE_COIL_MAP[deviceId];
  
  if (coilAddress !== undefined) {
    try {
      await client.writeCoil(coilAddress, state);
      console.log(`[Factory I/O] 🟢 Wrote Coil ${coilAddress} for ${deviceId} -> ${state ? 'ON' : 'OFF'}`);
      return true;
    } catch (err) {
      console.error(`[Factory I/O] ❌ Failed to write Coil ${coilAddress}:`, err.message);
      // ถ้าเขียนล้มเหลว อาจจะหลุดการเชื่อมต่อ ให้พยายามต่อใหม่
      isConnected = false;
      setTimeout(connect, 2000);
      return false;
    }
  } else {
    console.log(`[Factory I/O] ⚠️ No coil mapping found for device: ${deviceId}`);
    return false;
  }
};

/**
 * หยุดการเชื่อมต่อ (สำหรับ Shutdown)
 */
const disconnect = () => {
  if (isConnected) {
    client.close();
    isConnected = false;
    console.log(`[Factory I/O] 🛑 Disconnected.`);
  }
};

module.exports = {
  connect,
  writeDeviceState,
  disconnect,
  isConnected: () => isConnected,
  getDeviceMap: () => DEVICE_COIL_MAP
};
