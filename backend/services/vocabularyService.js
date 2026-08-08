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
    // Built-in
    "สายพาน": "conveyor1", "สายพาน1": "conveyor1", "สายพาน 1": "conveyor1",
    "conveyor": "conveyor1", "conveyor1": "conveyor1",
    "สายพาน2": "conveyor2", "สายพาน 2": "conveyor2", "conveyor2": "conveyor2",
    "มอเตอร์": "motor1", "มอเตอร์หลัก": "motor1", "motor": "motor1", "motor1": "motor1",
    "ปั๊ม": "pump1", "ปั๊มน้ำ": "pump1", "pump": "pump1", "pump1": "pump1",
    "พัดลม": "fan1", "fan": "fan1", "fan1": "fan1",
    "หุ่นยนต์": "robot1", "แขนกล": "robot1", "robot": "robot1", "robot1": "robot1",
    "agv": "agv1", "agv1": "agv1", "รถ agv": "agv1", "รถลำเลียง": "agv1", "เอจีวี": "agv1",
    "ฮีตเตอร์": "heater1", "heater": "heater1", "heater1": "heater1", "เตาอบ": "heater1", "เครื่องทำความร้อน": "heater1",
    "ปั๊มลม": "compressor1", "ปั้มลม": "compressor1", "compressor": "compressor1", "compressor1": "compressor1", "คอมเพรสเซอร์": "compressor1",
    "เครน": "crane1", "crane": "crane1", "crane1": "crane1", "รอก": "crane1", "รอกไฟฟ้า": "crane1",
    "ไฟสัญญาณ": "light1", "ไฟเตือน": "light1", "light": "light1", "light1": "light1", "ไฟอลาร์ม": "light1",
    "ชิลเลอร์": "chiller1", "chiller": "chiller1", "chiller1": "chiller1", "เครื่องทำความเย็น": "chiller1",
    // Custom aliases
    ...vocab.deviceAliases
  };

  // 3. หา action จาก aliases (รวม built-in)
  const allActionAliases = {
    "เปิด": "start", "start": "start", "on": "start", "เดิน": "start",
    "สตาร์ท": "start", "เริ่ม": "start", "รัน": "start", "run": "start",
    "หยุด": "stop", "stop": "stop", "off": "stop", "ปิด": "stop",
    "หยุดเดิน": "stop", "ดับ": "stop",
    "ฉุกเฉิน": "emergency_stop", "emergency": "emergency_stop",
    "estop": "emergency_stop", "e-stop": "emergency_stop",
    "รีเซ็ต": "reset", "reset": "reset", "เริ่มใหม่": "reset",
    "ตั้ง": "set_speed", "ปรับ": "set_speed", "เร่ง": "set_speed", "ลด": "set_speed",
    "ตั้งความเร็ว": "set_speed", "ปรับความเร็ว": "set_speed",
    "ตั้งความร้อน": "set_speed", "ปรับความร้อน": "set_speed", "เร่งความร้อน": "set_speed",
    "ตั้งอุณหภูมิ": "set_speed", "ปรับอุณหภูมิ": "set_speed",
    "ตั้งแรงดัน": "set_speed", "ปรับแรงดัน": "set_speed",
    "ตั้งไฟ": "set_speed", "ปรับไฟ": "set_speed", "ตั้งความสว่าง": "set_speed",
    "ตั้งความเย็น": "set_speed", "ปรับความเย็น": "set_speed", "เร่งความเย็น": "set_speed",
    "ตั้งอัตราไหล": "set_speed", "ปรับอัตราไหล": "set_speed",
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

  // หา speed (ลบ matchedDeviceKey ออกก่อนเพื่อไม่ให้ "สายพาน 1" สับสนกับ speed 1)
  const params = {};
  let textForSpeed = lower;
  if (matchedDeviceKey) {
    textForSpeed = textForSpeed.replace(matchedDeviceKey, "");
  }
  const speedMatch = textForSpeed.match(/(\d+)/);
  if (speedMatch) {
    const val = parseInt(speedMatch[1], 10);
    if (val >= 0 && val <= 100) {
      params.speed = val;
      if (foundAction === "start" || foundAction === "chat") foundAction = "set_speed";
    }
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
