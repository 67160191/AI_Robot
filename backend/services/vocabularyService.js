// ============================================================
// Vocabulary Service - จัดการคลังคำสั่งที่กำหนดเอง
// ============================================================

const fs   = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const VOCAB_PATH = path.join(__dirname, "../config/vocabulary.json");

function load() {
  try {
    const raw = fs.readFileSync(VOCAB_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { deviceAliases: {}, actionAliases: {}, customCommands: [] };
  }
}

function save(data) {
  fs.writeFileSync(VOCAB_PATH, JSON.stringify(data, null, 2), "utf8");
}

// รับ vocab ทั้งหมด
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
    // Custom aliases
    ...vocab.actionAliases
  };

  // ค้นหา device (longest match first)
  let foundDevice = null;
  const deviceKeys = Object.keys(allDeviceAliases).sort((a, b) => b.length - a.length);
  for (const key of deviceKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundDevice = allDeviceAliases[key];
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

  // หา speed
  const speedMatch = message.match(/(\d+)\s*%/);
  const params = {};
  if (speedMatch) {
    params.speed = parseInt(speedMatch[1]);
    if (foundAction === "start" || foundAction === "chat") foundAction = "set_speed";
  }

  if (foundDevice && foundAction !== "chat") {
    return {
      found: true,
      source: "vocab_match",
      device: foundDevice,
      action: foundAction,
      params,
      message: `[Vocab] ${foundAction} ${foundDevice}${params.speed ? ` ${params.speed}%` : ""}`
    };
  }

  return { found: false };
}

module.exports = {
  getAll, addDeviceAlias, addActionAlias,
  addCustomCommand, deleteCustomCommand, deleteAlias,
  searchVocab
};
