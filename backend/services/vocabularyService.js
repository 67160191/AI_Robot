// ============================================================
// Vocabulary Service - จัดการคลังคำสั่งที่กำหนดเอง + Fuzzy Matching
// ============================================================

const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const VOCAB_PATH = path.join(__dirname, "../config/vocabulary.json");

// ─── In-memory cache ────────────────────────────────────────
let _cache = null;
let _promptCacheInvalidated = false;

function _invalidateCache() {
  _cache = null;
  _promptCacheInvalidated = true;
}

function isPromptDirty() {
  const dirty = _promptCacheInvalidated;
  _promptCacheInvalidated = false;
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
  _cache = data;
  _invalidateCache();
  _cache = data;
  fs.writeFileSync(VOCAB_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ─── Levenshtein Distance — สำหรับ Fuzzy Matching ────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(text, target, threshold = 0.45) {
  const lowerText = text.toLowerCase().trim();
  const lowerTarget = target.toLowerCase().trim();
  if (lowerText.includes(lowerTarget)) return { matched: true, distance: 0, confidence: 1 };

  let bestMatch = null;
  for (const alias of Object.keys(target).length ? [target] : []) {
    // Fuzzy matching placeholder — ใช้ only Levenshtein เปรียบเทียบโดยตรง
  }

  return { matched: false, distance: Infinity, confidence: 0 };
}

// ─── Built-in Device Aliases (ครบถ้วน) ───────────────────────
function getAllDeviceAliases() {
  const vocab = load();
  return {
    "สายพาน 1": "conveyor1", "สายพาน1": "conveyor1", "ไลน์ผลิต 1": "conveyor1", "ไลน์ที่ 1": "conveyor1", "สายส่ง 1": "conveyor1", "สายลำเลียง 1": "conveyor1",
    "conveyor 1": "conveyor1", "conveyor1": "conveyor1", "สายพาน": "conveyor1", "ไลน์ผลิต": "conveyor1", "ไลน์": "conveyor1", "สายส่ง": "conveyor1", "สายลำเลียง": "conveyor1",

    "สายพาน 2": "conveyor2", "สายพาน2": "conveyor2", "ไลน์ผลิต 2": "conveyor2", "ไลน์ที่ 2": "conveyor2", "สายส่ง 2": "conveyor2", "สายลำเลียง 2": "conveyor2",
    "conveyor 2": "conveyor2", "conveyor2": "conveyor2",

    "มอเตอร์หลัก": "motor1", "มอเตอร์เมน": "motor1", "เมนมอเตอร์": "motor1", "มอเตอร์ไฟฟ้า": "motor1", "มอเตอร์ขับ": "motor1",
    "มอเตอร์ 1": "motor1", "มอเตอร์1": "motor1", "มอเตอร์": "motor1",
    "motor 1": "motor1", "motor1": "motor1", "m1": "motor1", "main motor": "motor1",

    "ปั๊มน้ำหล่อเย็น": "pump1", "ปั้มน้ำหล่อเย็น": "pump1", "ปั๊มหล่อเย็น": "pump1", "ปั้มหล่อเย็น": "pump1",
    "ปั๊มน้ำเย็น": "pump1", "เครื่องปั๊มน้ำ": "pump1", "เครื่องปั้มน้ำ": "pump1",
    "ปั๊มน้ำ 1": "pump1", "ปั้มน้ำ 1": "pump1", "ปั๊มน้ำ1": "pump1", "ปั้มน้ำ1": "pump1", "ปั๊มน้ำ": "pump1", "ปั้มน้ำ": "pump1",
    "pump 1": "pump1", "pump1": "pump1", "p1": "pump1", "cooling pump": "pump1",

    "พัดลมระบายความร้อน": "fan1", "พัดลมระบายอากาศ": "fan1", "พัดลมคูลลิ่ง": "fan1",
    "พัดลม 1": "fan1", "พัดลม1": "fan1", "พัดลม": "fan1",
    "แฟน": "fan1", "fan 1": "fan1", "fan1": "fan1", "f1": "fan1",

    "หุ่นยนต์แขนกล": "robot1", "แขนหุ่นยนต์": "robot1",
    "หุ่นยนต์ 1": "robot1", "หุ่นยนต์1": "robot1", "หุ่นยนต์": "robot1",
    "แขนกล 1": "robot1", "แขนกล1": "robot1", "แขนกล": "robot1",
    "robot 1": "robot1", "robot1": "robot1", "r1": "robot1",

    "รถ agv 1": "agv1", "รถ agv1": "agv1", "รถเอจีวี 1": "agv1", "รถเอจีวี": "agv1",
    "รถลำเลียง 1": "agv1", "รถลำเลียง": "agv1",
    "เอจีวี 1": "agv1", "เอจีวี1": "agv1", "เอจีวี": "agv1",
    "agv 1": "agv1", "agv1": "agv1", "รถขนของ": "agv1",

    "เครื่องทำความร้อน": "heater1", "ฮีตเตอร์เตาอบ": "heater1", "ฮีทเตอร์เตาอบ": "heater1", "ฮิตเตอร์เตาอบ": "heater1",
    "ฮิทเตอร์เตาอบ": "heater1", "ฮีตเตอร์ 1": "heater1", "ฮีตเตอร์1": "heater1", "ฮีตเตอร์": "heater1",
    "ฮีทเตอร์ 1": "heater1", "ฮีทเตอร์1": "heater1", "ฮีทเตอร์": "heater1",
    "ฮิตเตอร์ 1": "heater1", "ฮิตเตอร์1": "heater1", "ฮิตเตอร์": "heater1",
    "ฮิทเตอร์ 1": "heater1", "ฮิทเตอร์1": "heater1", "ฮิทเตอร์": "heater1",
    "เตาอบ 1": "heater1", "เตาอบ1": "heater1", "เตาอบ": "heater1",
    "เครื่องอบ": "heater1", "heater 1": "heater1", "heater1": "heater1", "oven heater": "heater1",

    "เครื่องปั๊มลม 1": "compressor1", "เครื่องปั้มลม 1": "compressor1", "เครื่องปั๊มลม": "compressor1", "เครื่องปั้มลม": "compressor1",
    "เครื่องอัดลม 1": "compressor1", "เครื่องอัดลม1": "compressor1", "เครื่องอัดลม": "compressor1",
    "ปั๊มลม 1": "compressor1", "ปั้มลม 1": "compressor1", "ปั๊มลม1": "compressor1", "ปั้มลม1": "compressor1", "ปั๊มลม": "compressor1", "ปั้มลม": "compressor1",
    "คอมเพรสเซอร์ 1": "compressor1", "คอมเพรสเซอร์1": "compressor1", "คอมเพรสเซอร์": "compressor1",
    "compressor 1": "compressor1", "compressor1": "compressor1", "air compressor": "compressor1",

    "เครนยกสินค้า": "crane1", "เครน 1": "crane1", "เครน1": "crane1", "เครน": "crane1",
    "รอกไฟฟ้า": "crane1", "รอก 1": "crane1", "รอก1": "crane1", "รอก": "crane1",
    "crane 1": "crane1", "crane1": "crane1", "overhead crane": "crane1",

    "ไฟสัญญาณเตือน": "light1", "ไฟสัญญาณ": "light1", "ไฟสัญญาน": "light1", "ไฟเตือน 1": "light1", "ไฟเตือน1": "light1",
    "ไฟเตือน": "light1", "ไฟอลาร์ม": "light1", "ไฟ tower": "light1", "tower light": "light1",
    "light 1": "light1", "light1": "light1", "ไฟหมุน": "light1", "ไฟกระพริบ": "light1",

    "เครื่องทำความเย็น 1": "chiller1", "เครื่องทำความเย็น1": "chiller1", "เครื่องทำความเย็น": "chiller1",
    "ชิลเลอร์ 1": "chiller1", "ชิลเลอร์1": "chiller1", "ชิลเลอร์": "chiller1", "ชิเลอร์": "chiller1",
    "chiller 1": "chiller1", "chiller1": "chiller1", "แอร์": "chiller1",

    "ทุกเครื่อง": "all", "ทุกอย่าง": "all", "ทั้งหมด": "all", "ระบบ": "all", "ทุกตัว": "all", "เครื่องจักรทั้งหมด": "all", "all": "all"
  };
}

// ─── Built-in Action Aliases (ครบถ้วน) ───────────────────────
function getAllActionAliases() {
  const vocab = load();
  return {
    "หยุดฉุกเฉิน": "emergency_stop", "ดับฉุกเฉิน": "emergency_stop", "ฉุกเฉิน": "emergency_stop",
    "emergency stop": "emergency_stop", "emergency": "emergency_stop",
    "estop": "emergency_stop", "e-stop": "emergency_stop", "หยุดด่วน": "emergency_stop", "อันตราย": "emergency_stop", "หยุดทันที": "emergency_stop",

    "รีเซ็ต": "reset", "รีเซต": "reset", "reset": "reset", "เริ่มต้นใหม่": "reset", "เริ่มใหม่": "reset", "ค่าเริ่มต้น": "reset", "ล้างค่า": "reset", "คืนค่า": "reset",

    "ตั้งความเร็ว": "set_speed", "ปรับความเร็ว": "set_speed", "เร่งความเร็ว": "set_speed", "ลดความเร็ว": "set_speed", "เพิ่มความเร็ว": "set_speed",
    "ตั้งอุณหภูมิ": "set_speed", "ปรับอุณหภูมิ": "set_speed", "เร่งอุณหภูมิ": "set_speed", "ลดอุณหภูมิ": "set_speed", "เพิ่มอุณหภูมิ": "set_speed",
    "ตั้งความร้อน": "set_speed", "ปรับความร้อน": "set_speed", "เร่งความร้อน": "set_speed", "ลดความร้อน": "set_speed", "เพิ่มความร้อน": "set_speed",
    "ตั้งแรงดัน": "set_speed", "ปรับแรงดัน": "set_speed", "เร่งแรงดัน": "set_speed", "ลดแรงดัน": "set_speed", "เพิ่มแรงดัน": "set_speed",
    "ตั้งความสว่าง": "set_speed", "ปรับความสว่าง": "set_speed", "ตั้งไฟ": "set_speed", "ปรับไฟ": "set_speed",
    "ตั้งความเย็น": "set_speed", "ปรับความเย็น": "set_speed", "เร่งความเย็น": "set_speed", "ลดความเย็น": "set_speed", "เพิ่มความเย็น": "set_speed",
    "ความเร็ว": "set_speed", "สปีด": "set_speed", "speed": "set_speed", "ระดับ": "set_speed", "แรงดัน": "set_speed", "อุณหภูมิ": "set_speed",
    "ตั้ง": "set_speed", "ปรับ": "set_speed", "เร่ง": "set_speed", "ลด": "set_speed", "เพิ่ม": "set_speed", "ยก": "set_speed", "หมุน": "set_speed", "เซ็ต": "set_speed", "ตั่ง": "set_speed",

    "หยุดเดิน": "stop", "หยุดทำงาน": "stop", "ดับเครื่อง": "stop", "ปิดเครื่อง": "stop", "หยุด": "stop", "stop": "stop", "off": "stop",
    "ปิด": "stop", "ดับ": "stop", "พัก": "stop", "พักเครื่อง": "stop", "ยกเลิก": "stop", "หยุถ": "stop", "หยด": "stop",

    "สตาร์ทเครื่อง": "start", "สตาร์ท": "start", "เริ่มเดิน": "start", "เริ่มทำงาน": "start", "เดินเครื่อง": "start", "เปิดเครื่อง": "start", "ทำงาน": "start", "ให้ทำงาน": "start", "เปิดระบบ": "start",
    "เริ่ม": "start", "เปิด": "start", "start": "start", "on": "start", "เดิน": "start", "รัน": "start", "run": "start", "go": "start", "ติด": "start", "ปล่อย": "start"
  };
}

// ─── Fuzzy Search — ใช้ fuzzy matching (Levenshtein Distance) ─
function fuzzySearch(text) {
  const lower = text.toLowerCase().trim();
  const vocab = load();
  const threshold = 0.45;

  // Merge custom aliases
  const allDevices = { ...getAllDeviceAliases(), ...vocab.deviceAliases };
  const allActions = { ...getAllActionAliases(), ...vocab.actionAliases };

  let bestDevice = null, bestDeviceSim = 0;
  let bestAction = null, bestActionSim = 0;

  // Fuzzy device match
  for (const [alias, id] of Object.entries(allDevices)) {
    const aliasLower = alias.toLowerCase();
    if (lower.includes(aliasLower)) {
      bestDevice = id;
      bestDeviceSim = 1;
      break;
    }
    const dist = levenshtein(lower, aliasLower);
    const maxLen = Math.max(lower.length, aliasLower.length);
    const similarity = 1 - (dist / maxLen);
    if (similarity >= threshold && similarity > bestDeviceSim) {
      bestDeviceSim = similarity;
      bestDevice = id;
    }
  }

  // Fuzzy action match
  for (const [alias, act] of Object.entries(allActions)) {
    const aliasLower = alias.toLowerCase();
    if (lower.includes(aliasLower)) {
      bestAction = act;
      bestActionSim = 1;
      break;
    }
    const dist = levenshtein(lower, aliasLower);
    const maxLen = Math.max(lower.length, aliasLower.length);
    const similarity = 1 - (dist / maxLen);
    if (similarity >= threshold && similarity > bestActionSim) {
      bestActionSim = similarity;
      bestAction = act;
    }
  }

  return { device: bestDevice, action: bestAction, confidences: { device: bestDeviceSim, action: bestActionSim } };
}

// ─── รับ vocab ทั้งหมด ────────────────────────────────────────
function getAll() {
  return load();
}

// เพิ่ม device alias
function addDeviceAlias(alias, deviceId) {
  const vocab = load();
  vocab.deviceAliases[alias.trim()] = deviceId;
  save(vocab);
  return vocab.deviceAliases;
}

// เพิ่ม action alias
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

// ─── ค้นหาคำสั่งจาก vocab ──────────────────────────────────────
function searchVocab(message) {
  const vocab = load();
  const lower = message.toLowerCase().trim();

  // 1. ตรวจ customCommands ก่อน
  for (const cmd of vocab.customCommands) {
    if (lower.includes(cmd.phrase.toLowerCase())) {
      return {
        found: true,
        source: "custom_command",
        device: cmd.device,
        action: cmd.action,
        params: cmd.params,
        message: `[Custom] ${cmd.note || cmd.phrase}`,
        confidence: 1.0
      };
    }
  }

  // 2. Exact/partial match (longest first)
  const allDevices = { ...getAllDeviceAliases(), ...vocab.deviceAliases };
  const allActions = { ...getAllActionAliases(), ...vocab.actionAliases };

  const deviceKeys = Object.keys(allDevices).sort((a, b) => b.length - a.length);
  let foundDevice = null;
  for (const key of deviceKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundDevice = allDevices[key];
      break;
    }
  }

  const actionKeys = Object.keys(allActions).sort((a, b) => b.length - a.length);
  let foundAction = "chat";
  for (const key of actionKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundAction = allActions[key];
      break;
    }
  }

  // หา speed
  const params = {};
  const matchedDeviceKey = deviceKeys.find(k => lower.includes(k.toLowerCase()));
  let textForSpeed = matchedDeviceKey ? lower.replace(new RegExp(matchedDeviceKey, "gi"), "") : lower;
  textForSpeed = textForSpeed.replace(/e-stop|estop/gi, "");

  const allNums = [...textForSpeed.matchAll(/(\d+)/g)].map(m => parseInt(m[1], 10));
  let speedVal = allNums.length > 0 ? allNums[allNums.length - 1] : null;

  if (speedVal === null) {
    if (/เต็มที่|เต็มร้อย|สูงสุด|สุดๆ|สุดกำลัง|ร้อยเปอร์เซ็น|แม็กซ์|แรงสุด|ร้อยเปอ|เต็มแม็ก|เต็มพิกัด/.test(textForSpeed)) speedVal = 100;
    else if (/ครึ่งนึง|ครึ่งหนึ่ง|ห้าสิบ/.test(textForSpeed)) speedVal = 50;
    else if (/เบาๆ|นิดเดียว|ต่ำสุด|น้อยสุด|ช้าๆ/.test(textForSpeed)) speedVal = 20;
  }

  if (speedVal !== null && speedVal >= 0 && speedVal <= 100) {
    params.speed = speedVal;
    if (foundAction === "start" || foundAction === "chat") foundAction = "set_speed";
  }

  if (foundDevice && foundAction !== "chat") {
    return {
      found: true,
      source: "vocab_match",
      device: foundDevice,
      action: foundAction,
      params,
      message: `[Vocab] ${foundAction} ${foundDevice}${params.speed !== undefined ? ` ${params.speed}%` : ""}`,
      confidence: 1.0
    };
  }

  // ─── Fallback → Fuzzy Match (พิมพ์ผิด / คำย่อ) ─────────────
  const fuzzyResult = fuzzySearch(message);
  if (fuzzyResult.device && fuzzyResult.action && fuzzyResult.confidences.device >= 0.6) {
    return {
      found: true,
      source: "fuzzy_vocab_match",
      device: fuzzyResult.device,
      action: fuzzyResult.action,
      params: {},
      message: `[Fuzzy Match] ${fuzzyResult.action} ${fuzzyResult.device} (confidence: ${(fuzzyResult.confidences.device * 100).toFixed(0)}%)`,
      confidence: fuzzyResult.confidences.device,
      fuzzy: true
    };
  }

  return { found: false };
}

module.exports = {
  getAll, addDeviceAlias, addActionAlias,
  addCustomCommand, deleteCustomCommand, deleteAlias,
  searchVocab, isPromptDirty, fuzzySearch
};