// ============================================================
// Vocabulary Service - จัดการคลังคำสั่งที่กำหนดเอง
// ============================================================

const fs   = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const VOCAB_PATH = path.join(__dirname, "../config/vocabulary.json");

// ─── In-memory cache (หลีกเลี่ยงอ่าน disk ทุก request) ───────
let _cache = null;
let _promptCacheInvalidated = false; // flag บอก ollamaService ว่า prompt ต้อง rebuild

function _invalidateCache() {
  _cache = null;
  _promptCacheInvalidated = true;
}

function isPromptDirty() {
  const dirty = _promptCacheInvalidated;
  _promptCacheInvalidated = false; // reset หลังอ่าน
  return dirty;
}

function load() {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(VOCAB_PATH, "utf8");
    _cache = JSON.parse(raw);
  } catch {
    _cache = { deviceAliases: {}, actionAliases: {}, customCommands: [] };
  }
  return _cache;
}

function save(data) {
  _cache = data; // อัพเดต cache ทันที ไม่ต้องอ่านกลับ
  _invalidateCache();
  _cache = data; // restore หลัง invalidate เพื่อไม่ต้องอ่าน disk รอบถัดไป
  fs.writeFileSync(VOCAB_PATH, JSON.stringify(data, null, 2), "utf8");
}

// รับ vocab ทั้งหมด (จาก cache)
function getAll() {
  return load();
}

// เพิ่ม device alias ("ไลน์ผลิต" → "conveyor1")
function addDeviceAlias(alias, deviceId) {
  const vocab = load();
  vocab.deviceAliases[alias.trim()] = deviceId;
  save(vocab);
  return vocab.deviceAliases;
}

// เพิ่ม action alias ("สตาร์ท" → "start")
function addActionAlias(alias, action) {
  const vocab = load();
  vocab.actionAliases[alias.trim()] = action;
  save(vocab);
  return vocab.actionAliases;
}

// เพิ่ม custom command shortcut
function addCustomCommand({ phrase, device, action, params = {}, note = "" }) {
  const vocab = load();
  const cmd = {
    id: `cmd-${uuidv4().slice(0, 8)}`,
    phrase: phrase.trim(),
    device,
    action,
    params,
    note
  };
  vocab.customCommands.push(cmd);
  save(vocab);
  return cmd;
}

// ลบ custom command
function deleteCustomCommand(id) {
  const vocab = load();
  vocab.customCommands = vocab.customCommands.filter(c => c.id !== id);
  save(vocab);
}

// ลบ alias
function deleteAlias(type, key) {
  const vocab = load();
  if (type === "device") delete vocab.deviceAliases[key];
  if (type === "action") delete vocab.actionAliases[key];
  save(vocab);
}

// ========== ค้นหาคำสั่งจาก vocab ==========
function searchVocab(message) {
  const vocab = load();
  const lower = message.toLowerCase().trim();

  // 1. ตรวจ customCommands ก่อน (exact match + partial)
  for (const cmd of vocab.customCommands) {
    if (lower.includes(cmd.phrase.toLowerCase())) {
      return {
        found: true,
        source: "custom_command",
        device: cmd.device,
        action: cmd.action,
        params: cmd.params,
        message: `[Custom] ${cmd.note || cmd.phrase}`
      };
    }
  }

  // 2. หา device จาก aliases (รวม built-in)
  const allDeviceAliases = {
    // Conveyor 1
    "สายพาน 1": "conveyor1", "สายพาน1": "conveyor1", "สายพานที่ 1": "conveyor1", "สายพานที่1": "conveyor1", "สายพานที่หนึ่ง": "conveyor1",
    "ไลน์ 1": "conveyor1", "ไลน์1": "conveyor1", "ไลน์ผลิต 1": "conveyor1", "ไลน์ผลิต1": "conveyor1", "ไลน์ที่ 1": "conveyor1", "ไลน์ที่1": "conveyor1",
    "สายส่ง 1": "conveyor1", "สายส่ง1": "conveyor1", "สายลำเลียง 1": "conveyor1", "สายลำเลียง1": "conveyor1",
    "conveyor 1": "conveyor1", "conveyor1": "conveyor1",
    "สายพาน": "conveyor1", "ไลน์": "conveyor1", "ไลน์ผลิต": "conveyor1", "สายส่ง": "conveyor1", "สายลำเลียง": "conveyor1", "conveyor": "conveyor1",
    "สาบพาน": "conveyor1", "สานพาน": "conveyor1", "สายพาร": "conveyor1", "สายพา": "conveyor1",

    // Conveyor 2
    "สายพาน 2": "conveyor2", "สายพาน2": "conveyor2", "สายพานที่ 2": "conveyor2", "สายพานที่2": "conveyor2", "สายพานที่สอง": "conveyor2",
    "ไลน์ 2": "conveyor2", "ไลน์2": "conveyor2", "ไลน์ผลิต 2": "conveyor2", "ไลน์ผลิต2": "conveyor2", "ไลน์ที่ 2": "conveyor2", "ไลน์ที่2": "conveyor2",
    "สายส่ง 2": "conveyor2", "สายส่ง2": "conveyor2", "สายลำเลียง 2": "conveyor2", "สายลำเลียง2": "conveyor2",
    "conveyor 2": "conveyor2", "conveyor2": "conveyor2",

    // Motor 1
    "มอเตอร์หลัก": "motor1", "มอเตอร์เมน": "motor1", "เมนมอเตอร์": "motor1", "มอเตอร์ไฟฟ้า": "motor1", "มอเตอร์ขับ": "motor1",
    "มอเตอร์ 1": "motor1", "มอเตอร์1": "motor1", "มอเตอร์": "motor1",
    "motor 1": "motor1", "motor1": "motor1", "motor": "motor1", "m1": "motor1", "main motor": "motor1",
    "มอเตอ": "motor1", "มอเต้อ": "motor1", "มอเตอร": "motor1", "มอร์เตอร์": "motor1", "มอเตอณ": "motor1",

    // Cooling Pump 1 (pump1)
    "ปั๊มน้ำหล่อเย็น": "pump1", "ปั้มน้ำหล่อเย็น": "pump1", "ปั๊มหล่อเย็น": "pump1", "ปั้มหล่อเย็น": "pump1",
    "ปั๊มน้ำเย็น": "pump1", "ปั้มน้ำเย็น": "pump1", "เครื่องปั๊มน้ำ": "pump1", "เครื่องปั้มน้ำ": "pump1",
    "ปั๊มน้ำ 1": "pump1", "ปั้มน้ำ 1": "pump1", "ปั๊มน้ำ1": "pump1", "ปั้มน้ำ1": "pump1", "ปั๊มน้ำ": "pump1", "ปั้มน้ำ": "pump1",
    "ปั๊มหล่อ 1": "pump1", "ปั้มหล่อ 1": "pump1", "ปั๊มหล่อ": "pump1", "ปั้มหล่อ": "pump1",
    "ปั๊ม 1": "pump1", "ปั้ม 1": "pump1", "ปั๊ม1": "pump1", "ปั้ม1": "pump1", "ปั๊ม": "pump1", "ปั้ม": "pump1", "ปัม": "pump1", "ปั๊น": "pump1", "ป้ำ": "pump1",
    "pump 1": "pump1", "pump1": "pump1", "pump": "pump1", "p1": "pump1", "cooling pump": "pump1",

    // Air Compressor 1 (compressor1)
    "เครื่องปั๊มลม 1": "compressor1", "เครื่องปั้มลม 1": "compressor1", "เครื่องปั๊มลม1": "compressor1", "เครื่องปั้มลม1": "compressor1",
    "เครื่องปั๊มลม": "compressor1", "เครื่องปั้มลม": "compressor1",
    "เครื่องอัดลม 1": "compressor1", "เครื่องอัดลม1": "compressor1", "เครื่องอัดลม": "compressor1",
    "ปั๊มลม 1": "compressor1", "ปั้มลม 1": "compressor1", "ปั๊มลม1": "compressor1", "ปั้มลม1": "compressor1",
    "ปั๊มลม": "compressor1", "ปั้มลม": "compressor1", "ปัมลม": "compressor1", "ปั๊มลท": "compressor1",
    "ปั๊มอากาศ": "compressor1", "ปั้มอากาศ": "compressor1",
    "คอมเพรสเซอร์ 1": "compressor1", "คอมเพรสเซอร์1": "compressor1", "คอมเพรสเซอร์": "compressor1", "คอมเพรสเซ่อร์": "compressor1", "คอมเพรสเซอร": "compressor1",
    "compressor 1": "compressor1", "compressor1": "compressor1", "compressor": "compressor1", "air compressor": "compressor1", "คอมแอร์": "compressor1",

    // Fan 1 (fan1)
    "พัดลมระบายความร้อน": "fan1", "พัดลมระบายอากาศ": "fan1", "พัดลมระบาย": "fan1", "พัดลมคูลลิ่ง": "fan1", "พัดลมดูดอากาศ": "fan1",
    "พัดลม 1": "fan1", "พัดลม1": "fan1", "พัดลม": "fan1", "พัดลน": "fan1", "พัตลม": "fan1", "พัด": "fan1", "พัศลม": "fan1",
    "แฟน": "fan1", "fan 1": "fan1", "fan1": "fan1", "fan": "fan1", "f1": "fan1", "cooling fan": "fan1",

    // Robot 1 (robot1)
    "หุ่นยนต์แขนกล": "robot1", "แขนหุ่นยนต์": "robot1", "แขนหุ่น": "robot1",
    "หุ่นยนต์ 1": "robot1", "หุ่นยนต์1": "robot1", "หุ่นยนต์": "robot1", "หุ่นยน": "robot1", "หุนยน": "robot1", "หุ่นยนต": "robot1", "หุนยนต์": "robot1",
    "แขนกล 1": "robot1", "แขนกล1": "robot1", "แขนกล": "robot1", "หุ่น": "robot1",
    "robot 1": "robot1", "robot1": "robot1", "robot": "robot1", "r1": "robot1", "robot arm": "robot1", "โรบอท": "robot1", "โรบอต": "robot1",

    // AGV 1 (agv1)
    "รถ agv 1": "agv1", "รถ agv1": "agv1", "รถ agv": "agv1", "รถเอจีวี 1": "agv1", "รถเอจีวี": "agv1",
    "รถลำเลียง 1": "agv1", "รถลำเลียง1": "agv1", "รถลำเลียง": "agv1",
    "เอจีวี 1": "agv1", "เอจีวี1": "agv1", "เอจีวี": "agv1", "เอจีวิ": "agv1",
    "agv 1": "agv1", "agv1": "agv1", "agv": "agv1", "agv transport": "agv1", "รถขนของ": "agv1",

    // Oven Heater 1 (heater1)
    "เครื่องทำความร้อน": "heater1", "ฮีตเตอร์เตาอบ": "heater1", "ฮีทเตอร์เตาอบ": "heater1", "ฮิตเตอร์เตาอบ": "heater1",
    "ฮีตเตอร์ 1": "heater1", "ฮีตเตอร์1": "heater1", "ฮีตเตอร์": "heater1", "ฮีตเตอ": "heater1", "ฮีตเต้อ": "heater1", "ฮีดเตอร์": "heater1",
    "ฮีทเตอร์ 1": "heater1", "ฮีทเตอร์1": "heater1", "ฮีทเตอร์": "heater1",
    "ฮิตเตอร์ 1": "heater1", "ฮิตเตอร์1": "heater1", "ฮิตเตอร์": "heater1",
    "ฮิทเตอร์ 1": "heater1", "ฮิทเตอร์1": "heater1", "ฮิทเตอร์": "heater1",
    "เตาอบ 1": "heater1", "เตาอบ1": "heater1", "เตาอบ": "heater1", "เครื่องอบ": "heater1",
    "heater 1": "heater1", "heater1": "heater1", "heater": "heater1", "oven heater": "heater1", "ความร้อน": "heater1",

    // Overhead Crane 1 (crane1)
    "เครนยกสินค้า": "crane1", "เครน 1": "crane1", "เครน1": "crane1", "เครน": "crane1", "เคลน": "crane1", "เคน": "crane1",
    "รอกไฟฟ้า": "crane1", "รอก 1": "crane1", "รอก1": "crane1", "รอก": "crane1", "ลอก": "crane1",
    "crane 1": "crane1", "crane1": "crane1", "crane": "crane1", "overhead crane": "crane1",

    // Tower Light 1 (light1)
    "ไฟสัญญาณเตือน": "light1", "ไฟสัญญาณ": "light1", "ไฟสัญญาน": "light1", "ไฟเตือน 1": "light1", "ไฟเตือน1": "light1", "ไฟเตือน": "light1",
    "ไฟอลาร์ม": "light1", "ไฟเตือนภัย": "light1", "ไฟ tower": "light1", "tower light": "light1",
    "light 1": "light1", "light1": "light1", "light": "light1", "ไฟหมุน": "light1", "ไฟกระพริบ": "light1", "ไฟ": "light1",

    // Chiller 1 (chiller1)
    "เครื่องทำความเย็น 1": "chiller1", "เครื่องทำความเย็น1": "chiller1", "เครื่องทำความเย็น": "chiller1",
    "ชิลเลอร์ 1": "chiller1", "ชิลเลอร์1": "chiller1", "ชิลเลอร์": "chiller1", "ชิลเล่อร์": "chiller1", "ชิลเลอร": "chiller1", "ชิลเลอ": "chiller1", "ชิเลอร์": "chiller1",
    "chiller 1": "chiller1", "chiller1": "chiller1", "chiller": "chiller1", "chiller unit": "chiller1", "แอร์": "chiller1",

    // ระบบทั้งหมด (all)
    "ทุกเครื่อง": "all", "ทุกอย่าง": "all", "ทั้งหมด": "all", "ระบบ": "all", "ทุกตัว": "all", "เครื่องจักรทั้งหมด": "all", "all": "all",

    // Custom aliases
    ...vocab.deviceAliases
  };

  // 3. หา action จาก aliases (เรียงจาก specific → general)
  const allActionAliases = {
    // Emergency Stop
    "หยุดฉุกเฉิน": "emergency_stop", "ดับฉุกเฉิน": "emergency_stop", "ฉุกเฉิน": "emergency_stop",
    "emergency stop": "emergency_stop", "emergency": "emergency_stop",
    "estop": "emergency_stop", "e-stop": "emergency_stop", "หยุดด่วน": "emergency_stop", "อันตราย": "emergency_stop", "หยุดทันที": "emergency_stop",

    // Reset
    "รีเซ็ต": "reset", "รีเซต": "reset", "reset": "reset", "เริ่มต้นใหม่": "reset", "เริ่มใหม่": "reset", "ค่าเริ่มต้น": "reset", "ล้างค่า": "reset", "คืนค่า": "reset",

    // Set speed / value
    "ตั้งความเร็ว": "set_speed", "ปรับความเร็ว": "set_speed", "เร่งความเร็ว": "set_speed", "ลดความเร็ว": "set_speed", "เพิ่มความเร็ว": "set_speed", "เปลี่ยนความเร็ว": "set_speed",
    "ตั้งอุณหภูมิ": "set_speed", "ปรับอุณหภูมิ": "set_speed", "เร่งอุณหภูมิ": "set_speed", "ลดอุณหภูมิ": "set_speed", "เพิ่มอุณหภูมิ": "set_speed",
    "ตั้งความร้อน": "set_speed", "ปรับความร้อน": "set_speed", "เร่งความร้อน": "set_speed", "ลดความร้อน": "set_speed", "เพิ่มความร้อน": "set_speed",
    "ตั้งแรงดัน": "set_speed", "ปรับแรงดัน": "set_speed", "เร่งแรงดัน": "set_speed", "ลดแรงดัน": "set_speed", "เพิ่มแรงดัน": "set_speed",
    "ตั้งความสว่าง": "set_speed", "ปรับความสว่าง": "set_speed", "ตั้งไฟ": "set_speed", "ปรับไฟ": "set_speed",
    "ตั้งความเย็น": "set_speed", "ปรับความเย็น": "set_speed", "เร่งความเย็น": "set_speed", "ลดความเย็น": "set_speed", "เพิ่มความเย็น": "set_speed",
    "ตั้งอัตราไหล": "set_speed", "ปรับอัตราไหล": "set_speed", "เร่งอัตราไหล": "set_speed", "ลดอัตราไหล": "set_speed", "เพิ่มอัตราไหล": "set_speed",
    "ความเร็ว": "set_speed", "สปีด": "set_speed", "speed": "set_speed", "ระดับ": "set_speed", "แรงดัน": "set_speed", "อุณหภูมิ": "set_speed", "ความร้อน": "set_speed", "ความเย็น": "set_speed",
    "ตั้ง": "set_speed", "ปรับ": "set_speed", "เร่ง": "set_speed", "ลด": "set_speed", "เพิ่ม": "set_speed", "ยก": "set_speed", "หมุน": "set_speed", "เซ็ต": "set_speed", "ตั่ง": "set_speed",

    // Stop
    "หยุดเดิน": "stop", "หยุดทำงาน": "stop", "ดับเครื่อง": "stop", "ปิดเครื่อง": "stop", "หยุด": "stop", "stop": "stop", "off": "stop",
    "ปิด": "stop", "ดับ": "stop", "พัก": "stop", "พักเครื่อง": "stop", "ยกเลิก": "stop", "ปิดระบบ": "stop", "หยุถ": "stop", "หยด": "stop",

    // Start
    "สตาร์ทเครื่อง": "start", "สตาร์ท": "start", "เริ่มเดิน": "start", "เริ่มทำงาน": "start", "เดินเครื่อง": "start", "เปิดเครื่อง": "start", "ทำงาน": "start", "ให้ทำงาน": "start", "เปิดระบบ": "start",
    "เริ่ม": "start", "เปิด": "start", "start": "start", "on": "start", "เดิน": "start", "รัน": "start", "run": "start", "go": "start", "ติด": "start", "ปล่อย": "start", "สตาท": "start", "สตาต": "start", "เปด": "start", "เปิต": "start",

    // Custom aliases
    ...vocab.actionAliases
  };

  // ค้นหา device (longest match first)
  let foundDevice = null;
  let matchedDeviceKey = "";
  const deviceKeys = Object.keys(allDeviceAliases).sort((a, b) => b.length - a.length);
  for (const key of deviceKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundDevice = allDeviceAliases[key];
      matchedDeviceKey = key.toLowerCase();
      break;
    }
  }

  // ค้นหา action (longest match first)
  let foundAction = "chat";
  const actionKeys = Object.keys(allActionAliases).sort((a, b) => b.length - a.length);
  for (const key of actionKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundAction = allActionAliases[key];
      break;
    }
  }

  // หา speed — ลบ matchedDeviceKey ออกก่อน จากนั้นดึงเลขสุดท้าย
  // ("สายพาน 1 ความเร็ว 80" → ลบ "สายพาน 1" → "ความเร็ว 80" → เลข 80)
  const params = {};
  let textForSpeed = lower;
  if (matchedDeviceKey) {
    // ลบ device key ออกทุก occurrence (ป้องกันเลขในชื่ออุปกรณ์)
    textForSpeed = textForSpeed.split(matchedDeviceKey).join(" ");
  }
  // ลบ action keywords ที่มีเลขในชื่อ เช่น "e-stop" ออก
  textForSpeed = textForSpeed.replace(/e-stop|estop/gi, "");

  // ดึง ALL ตัวเลข แล้วเลือกเลขสุดท้าย (มักเป็น speed value)
  const allNums = [...textForSpeed.matchAll(/(\d+)/g)].map(m => parseInt(m[1], 10));
  let speedVal = allNums.length > 0 ? allNums[allNums.length - 1] : null;

  // ค้นหา speed จากคำพูด (ถ้าไม่มีตัวเลข)
  if (speedVal === null) {
    if (/เต็มที่|เต็มร้อย|สูงสุด|สุดๆ|สุดกำลัง|ร้อยเปอร์เซ็น|แม็กซ์|แม็ก|แรงสุด|ร้อยเปอ|เต็มแม็ก|เต็มพิกัด/.test(textForSpeed)) {
      speedVal = 100;
    } else if (/ครึ่งนึง|ครึ่งหนึ่ง|ห้าสิบ/.test(textForSpeed)) {
      speedVal = 50;
    } else if (/เบาๆ|นิดเดียว|ต่ำสุด|น้อยสุด|ช้าๆ/.test(textForSpeed)) {
      speedVal = 20;
    }
  }

  if (speedVal !== null && speedVal >= 0 && speedVal <= 100) {
    params.speed = speedVal;
    // upgrade action เป็น set_speed เฉพาะถ้า action ยังไม่ชัดเจน
    if (foundAction === "start" || foundAction === "chat") foundAction = "set_speed";
  }

  if (foundDevice && foundAction !== "chat") {
    return {
      found: true,
      source: "vocab_match",
      device: foundDevice,
      action: foundAction,
      params,
      message: `[Vocab] ${foundAction} ${foundDevice}${params.speed !== undefined ? ` ${params.speed}%` : ""}`
    };
  }

  return { found: false };
}

module.exports = {
  getAll, addDeviceAlias, addActionAlias,
  addCustomCommand, deleteCustomCommand, deleteAlias,
  searchVocab, isPromptDirty
};
