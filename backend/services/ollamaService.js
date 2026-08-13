// ============================================================
// Ollama AI Service - แปลงภาษาธรรมชาติ → JSON Command (Best Version)
// Features: Vocab Pre-match + Fuzzy Matching + Confidence Scoring + Compound Commands + Context Awareness
// ============================================================

const axios = require("axios");
const vocabService = require("./vocabularyService");

const OLLAMA_URL = "http://10.80.84.24:11434";

// ─── Model Cache (TTL 5 นาที) ─────────────────────────────────
let _modelCache = {
  name: null,
  fetchedAt: 0,
  TTL: 5 * 60 * 1000
};

// ─── System Prompt Cache ──────────────────────────────────────
let _cachedPrompt = null;

// ─── Context Memory — จำคำสั่งล่าสุด ─────────────────────────
let _lastContext = {
  device: null,
  action: null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 นาที
};

function getContext() {
  const now = Date.now();
  if (now - _lastContext.timestamp > _lastContext.TTL) {
    _lastContext = { device: null, action: null, timestamp: now };
    return null;
  }
  return _lastContext.device ? { device: _lastContext.device, action: _lastContext.action } : null;
}

function updateContext(device, action) {
  _lastContext = { device, action, timestamp: Date.now() };
}

// ─── Token Reduction ──────────────────────────────────────────
const NUM_PREDICT = 100;
const KEEP_ALIVE = "30m";

// ─── ดึง model name (จาก cache หรือ fetch ใหม่) ───────────────
async function getModelName(forceModel = null) {
  const now = Date.now();
  const expired = now - _modelCache.fetchedAt > _modelCache.TTL;

  if (!forceModel && _modelCache.name && !expired) {
    return _modelCache.name;
  }

  try {
    const modelsRes = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const models = modelsRes.data.models || [];

    let selected = null;
    if (forceModel) {
      const found = models.find(m =>
        m.name === forceModel ||
        m.name.startsWith(forceModel + ":") ||
        m.name.toLowerCase().includes(forceModel.toLowerCase())
      );
      if (found) selected = found.name;
      else console.warn(`⚠️ Model "${forceModel}" ไม่พบ, ใช้ auto-detect`);
    }

    if (!selected) {
      const preferred = ["llama3.2", "qwen2.5", "llama", "qwen", "gemma", "mistral", "phi"];
      for (const pref of preferred) {
        const found = models.find(m => m.name.toLowerCase().includes(pref));
        if (found) { selected = found.name; break; }
      }
      if (!selected && models.length > 0) selected = models[0].name;
    }

    if (selected) {
      _modelCache.name = selected;
      _modelCache.fetchedAt = now;
    }
    return selected;
  } catch (err) {
    console.warn("⚠️ ไม่สามารถดึง model list:", err.message);
    return _modelCache.name || forceModel || null;
  }
}

// ─── Build system prompt (cached — rebuild เฉพาะเมื่อ vocab เปลี่ยน) ─
function getSystemPrompt() {
  const vocab = vocabService.getAll();

  const deviceAliasList = Object.entries(vocab.deviceAliases)
    .map(([alias, id]) => `  "${alias}" → ${id}`)
    .join("\n");

  const actionAliasList = Object.entries(vocab.actionAliases)
    .map(([alias, act]) => `  "${alias}" → ${act}`)
    .join("\n");

  const customCmdList = vocab.customCommands
    .map(c => `  "${c.phrase}" → device:${c.device} action:${c.action}${c.params?.speed ? ` speed:${c.params.speed}` : ""}`)
    .join("\n");

  _cachedPrompt = `You are a strict factory automation AI controller.
CRITICAL RULE #1: You must ONLY output a single valid JSON object. Do not include markdown blocks, code fences, or any other text.
CRITICAL RULE #2: NEVER translate, guess, or invent machine names. ALWAYS use the EXACT device id from the Device Mapping below.
CRITICAL RULE #3: If the user types ANY Thai word that matches a known device in the mapping, immediately use that exact device id.
CRITICAL RULE #4: If you see "ฮีตเตอร์", "ฮีทเตอร์", "เตาอบ" → MUST use "heater1". If you see "คอมเพรสเซอร์", "ปั๊มลม" → MUST use "compressor1". NEVER translate these to new names.

═══════════════════════════════════════
EXACT DEVICE MAPPING (Thai/ Alias → device_id)
═══════════════════════════════════════

CONVEYOR SYSTEMS:
  conveyor1 = สายพาน 1, สายพาน1, ไลน์ 1, ไลน์ผลิต 1, สายส่ง 1, conveyor 1, สายพาน, ไลน์, converyor,สาบพาน, สาบพาน, สานพาน
  conveyor2 = สายพาน 2, สายพาน2, ไลน์ 2, ไลน์ผลิต 2, สายส่ง 2, conveyor 2

MOTOR & POWER:
  motor1 = มอเตอร์หลัก, มอเตอร์เมน, เมนมอเตอร์, มอเตอร์ไฟฟ้า, มอเตอร์ขับ, มอเตอร์ 1, มอเตอร์1, motor 1, motor1, main motor, มอเตอร, มอร์เตอร์, m1

COOLING SYSTEMS:
  pump1 = ปั๊มน้ำหล่อเย็น, ปั้มน้ำหล่อเย็น, ปั๊มหล่อเย็น, ปั้มหล่อเย็น, ปั๊มน้ำเย็น, เครื่องปั๊มน้ำ, เครื่องปั้มน้ำ, ปั๊มน้ำ 1, ปั้มน้ำ 1, pump 1, pump1, cooling pump
  fan1 = พัดลมระบายความร้อน, พัดลมระบายอากาศ, พัดลม 1, พัดลม1, แฟน, fan 1, fan1, cooling fan
  chiller1 = เครื่องทำความเย็น 1, ชิลเลอร์ 1, ชิลเลอร์1, chiller 1, chiller1, ชิเลอร์, แอร์

ROBOTICS & MATERIAL HANDLING:
  robot1 = หุ่นยนต์แขนกล, หุ่นยนต์ 1, หุ่นยนต์1, แขนกล 1, แขนกล1, robot 1, robot1, robot arm, โรบอท, โรบอต
  agv1 = รถ agv 1, รถเอจีวี 1, เอจีวี 1, เอจีวี, agv 1, agv1, รถลำเลียง 1, รถขนของ
  crane1 = เครนยกสินค้า, เครน 1, เครน1, รอกไฟฟ้า, รอก 1, crane 1, crane1, overhed crane

HEATING SYSTEMS:
  heater1 = ฮีตเตอร์เตาอบ, ฮีทเตอร์เตาอบ, ฮิตเตอร์เตาอบ, ฮิทเตอร์เตาอบ, ฮีตเตอร์ 1, ฮีทเตอร์ 1, ฮิตเตอร์ 1, เตาอบ 1, เตายอบ, เครื่องทำความร้อน, heater 1, heater1, oven heater, ความร้อน

AIR COMPRESSOR:
  compressor1 = เครื่องปั๊มลม 1, เครื่องปั้มลม 1, เครื่องอัดลม 1, ปั๊มลม 1, ปั้มลม 1, คอมเพรสเซอร์ 1,คอมเพรสเซอร์1, air compressor, compressor 1, compressor1

SIGNALS & LIGHTS:
  light1 = ไฟสัญญาณเตือน, ไฟสัญญาณ, ไฟสัญญาน, ไฟเตือน 1, ไฟเตือน, ไฟอลาร์ม, tower light, light 1, light1, ไฟหมุน, ไฟกระพริบ

SPECIAL:
  all = ทั้งระบบ, ทุกเครื่อง, ทุกตัว, ทั้งหมด, ระบบ, ทุกเครื่องจักร, ทุกอย่าง, all
  null/None = คำที่ไม่ตรงกับอุปกรณ์ด้านบนเลย (อย่าสร้างชื่อใหม่!)

═══════════════════════════════════════
AVAILABLE ACTIONS:
═══════════════════════════════════════
  start         = เปิด, เปิดเครื่อง, เริ่ม, เดินเครื่อง, สตาร์ท, start, on, ติด, ปล่อย
  stop          = ปิด, ปิดเครื่อง, หยุด, ดับ, off, พัก, ยกเลิก
  set_speed     = ตั้งค่าความเร็ว/อุณหภูมิ/แรงดัน/ความสว่าง/ความเย็น (มีตัวเลขตามมา)
  emergency_stop = หยุดฉุกเฉิน, ดับฉุกเฉิน, emergency, estop, e-stop, หยุดด่วน, หยุดทันที
  reset         = รีเซ็ต, reset, เริ่มต้นใหม่, เริ่มใหม่, คืนค่า

═══════════════════════════════════════
SPEED/VALUE KEYWORDS:
═══════════════════════════════════════
  100 = ที่สุด, เต็มที่, เต็มร้อย, สูงสุด, สุดกำลัง, ร้อยเปอร์เซ็น, แม็กซ์, แรงสุด, เต็มพิกัด
  50  = ครึ่ง,ครึ่งหนึ่ง, ห้าสิบ
  20  = เบาๆ, นิดเดียว, ต่ำสุด, น้อยสุด, ช้าๆ

═══════════════════════════════════════
RULES (อ่านทุกบรรทัด):
═══════════════════════════════════════
1. ONLY return valid JSON: {"device":"<exact-id>","action":"<action>","params":{},"message":"<Thai confirmation>"}
2. NEVER create a new device id that is not in the list above.
3. If user types "ฮีตเตอร์" or "เตาอบ" → device MUST be "heater1" NOT a translated name.
4. If user types "คอมเพรสเซอร์" or "ปั๊มลม" → device MUST be "compressor1".
5. If input is NOT a recognizable command, return: {"device":null,"action":"chat","params":{},"message":"<response>"}
6. For speed commands with numbers (0-100): extract the last number in the message as speed value.
7. Thai confirmation message should be natural and confirm the action.
8. CONFIDENCE: Add a "confidence" field (0-1) to your response. 1.0 = very certain, <0.7 = uncertain — explain why briefly in message.

═══════════════════════════════════════
EXAMPLES (เรียนรู้จากตัวอย่างเหล่านี้):
═══════════════════════════════════════
"เปิดสายพาน 1" → {"device":"conveyor1","action":"start","params":{},"message":"เปิดสายพาน 1 แล้ว", "confidence":1.0}
"หยุดมอเตอร์หลัก" → {"device":"motor1","action":"stop","params":{},"message":"หยุดมอเตอร์หลักแล้ว", "confidence":1.0}
"ตั้งพัดลมระบายความร้อน 80%" → {"device":"fan1","action":"set_speed","params":{"speed":80},"message":"ตั้งพัดลมระบายความร้อน 80%", "confidence":1.0}
"ปิดเครื่องจักรทุกตัว" → {"device":"all","action":"stop","params":{},"message":"ปิดเครื่องจักรทั้งหมดแล้ว", "confidence":1.0}
"เปิดฮีตเตอร์เตาอบ" → {"device":"heater1","action":"start","params":{},"message":"เปิดฮีตเตอร์เตาอบแล้ว", "confidence":1.0}
"ตั้งอุณหภูมิฮีทเตอร์ 150" → {"device":"heater1","action":"set_speed","params":{"speed":150},"message":"ตั้งอุณหภูมิฮีทเตอร์ 150", "confidence":0.9}
"เร่งคอมเพรสเซอร์เบาๆ" → {"device":"compressor1","action":"set_speed","params":{"speed":20},"message":"เร่งคอมเพรสเซอร์เบาๆ", "confidence":1.0}
"เปิดเครื่องปั๊มลมแรงสุด" → {"device":"compressor1","action":"set_speed","params":{"speed":100},"message":"เปิดเครื่องปั๊มลมแรงสุดแล้ว", "confidence":1.0}
"หยุดฉุกเฉินมอเตอร์ 1" → {"device":"motor1","action":"emergency_stop","params":{},"message":"หยุดฉุกเฉินมอเตอร์ 1 แล้ว", "confidence":1.0}
"รีเซ็ตหุ่นยนต์แขนกล" → {"device":"robot1","action":"reset","params":{},"message":"รีเซ็ตหุ่นยนต์แขนกลแล้ว", "confidence":1.0}
${deviceAliasList ? `\n═══════════════════════════════════════\nCUSTOM DEVICE ALIASES:\n${deviceAliasList}\n` : ""}
${actionAliasList ? `\n═══════════════════════════════════════\nCUSTOM ACTION ALIASES:\n${actionAliasList}\n` : ""}
${customCmdList ? `\n═══════════════════════════════════════\nCUSTOM COMMANDS:\n${customCmdList}\n` : ""}`;

  console.log("📝 System prompt cache refreshed");
  return _cachedPrompt;
}

// ─── Warm-up: โหลด model เข้า memory ล่วงหน้า ────────────────
async function warmUp() {
  try {
    console.log("🔥 Warming up Ollama model...");
    const model = await getModelName();
    if (!model) { console.warn("⚠️ Warm-up: ไม่พบ model"); return; }

    await axios.post(`${OLLAMA_URL}/api/chat`, {
      model,
      messages: [{ role: "user", content: "ping" }],
      stream: false,
      keep_alive: KEEP_ALIVE,
      options: { num_predict: 1, temperature: 0 }
    }, { timeout: 30000 });

    console.log(`✅ Warm-up done — model "${model}" loaded in memory`);
  } catch (err) {
    console.warn("⚠️ Warm-up failed (Ollama ยังไม่พร้อม):", err.message);
  }
}

// ─── Vocab Pre-match — ตรวจ vocab ก่อนเรียก AI (Level 2) ──────
function vocabPreMatch(message) {
  const vocab = vocabService.getAll();
  const lower = message.toLowerCase().trim();

  // 1. ตรวจ custom commands ก่อน
  for (const cmd of vocab.customCommands) {
    if (lower.includes(cmd.phrase.toLowerCase())) {
      return {
        success: true,
        data: {
          device: cmd.device,
          action: cmd.action,
          params: cmd.params || {},
          message: `[Custom] ${cmd.note || cmd.phrase}`,
          model: `vocab-match:custom_command`,
          source: "vocab_pre_match",
          confidence: 1.0
        }
      };
    }
  }

  // 2. ตรวจ device aliases (built-in + custom)
  const allDeviceAliases = {
    ...vocab.deviceAliases,
    "สายพาน 1": "conveyor1", "สายพาน1": "conveyor1", "ไลน์ 1": "conveyor1", "ไลน์ผลิต 1": "conveyor1", "สายส่ง 1": "conveyor1", "conveyor 1": "conveyor1", "สายพาน": "conveyor1", "ไลน์": "conveyor1",
    "สายพาน 2": "conveyor2", "สายพาน2": "conveyor2", "ไลน์ 2": "conveyor2", "ไลน์ผลิต 2": "conveyor2", "สายส่ง 2": "conveyor2", "conveyor 2": "conveyor2",
    "มอเตอร์หลัก": "motor1", "มอเตอร์เมน": "motor1", "มอเตอร์ไฟฟ้า": "motor1", "มอเตอร์ขับ": "motor1", "มอเตอร์ 1": "motor1", "มอเตอร์1": "motor1", "มอเตอร์": "motor1", "motor 1": "motor1", "motor1": "motor1",
    "ปั๊มน้ำหล่อเย็น": "pump1", "ปั้มน้ำหล่อเย็น": "pump1", "ปั๊มหล่อเย็น": "pump1", "ปั้มหล่อเย็น": "pump1", "ปั๊มน้ำเย็น": "pump1", "เครื่องปั๊มน้ำ": "pump1", "เครื่องปั้มน้ำ": "pump1", "ปั๊มน้ำ 1": "pump1", "ปั้มน้ำ 1": "pump1", "ปั๊มน้ำ": "pump1", "ปั้มน้ำ": "pump1", "pump 1": "pump1", "pump1": "pump1",
    "พัดลมระบายความร้อน": "fan1", "พัดลมระบายอากาศ": "fan1", "พัดลม 1": "fan1", "พัดลม1": "fan1", "พัดลม": "fan1", "fan 1": "fan1", "fan1": "fan1",
    "หุ่นยนต์แขนกล": "robot1", "แขนหุ่นยนต์": "robot1", "หุ่นยนต์ 1": "robot1", "หุ่นยนต์1": "robot1", "หุ่นยนต์": "robot1", "แขนกล 1": "robot1", "แขนกล1": "robot1", "แขนกล": "robot1", "robot 1": "robot1", "robot1": "robot1",
    "รถ agv 1": "agv1", "รถ agv1": "agv1", "รถเอจีวี 1": "agv1", "รถเอจีวี": "agv1", "เอจีวี 1": "agv1", "เอจีวี1": "agv1", "เอจีวี": "agv1", "agv 1": "agv1", "agv1": "agv1", "รถลำเลียง 1": "agv1", "รถลำเลียง": "agv1",
    "ฮีตเตอร์เตาอบ": "heater1", "ฮีทเตอร์เตาอบ": "heater1", "ฮิตเตอร์เตาอบ": "heater1", "ฮิทเตอร์เตาอบ": "heater1", "ฮีตเตอร์ 1": "heater1", "ฮีทเตอร์ 1": "heater1", "ฮิตเตอร์ 1": "heater1", "เตาอบ 1": "heater1", "เตาอบ1": "heater1", "เตาอบ": "heater1", "เครื่องทำความร้อน": "heater1", "heater 1": "heater1", "heater1": "heater1", "ความร้อน": "heater1",
    "เครื่องปั๊มลม 1": "compressor1", "เครื่องปั้มลม 1": "compressor1", "เครื่องปั๊มลม": "compressor1", "เครื่องปั้มลม": "compressor1", "เครื่องอัดลม 1": "compressor1", "ปั๊มลม 1": "compressor1", "ปั้มลม 1": "compressor1", "ปั๊มลม": "compressor1", "ปั้มลม": "compressor1", "คอมเพรสเซอร์ 1": "compressor1", "คอมเพรสเซอร์1": "compressor1", "คอมเพรสเซอร์": "compressor1", "air compressor": "compressor1", "compressor 1": "compressor1", "compressor1": "compressor1",
    "เครนยกสินค้า": "crane1", "เครน 1": "crane1", "เครน1": "crane1", "เครน": "crane1", "รอกไฟฟ้า": "crane1", "รอก 1": "crane1", "rork 1": "crane1", "crane 1": "crane1", "crane1": "crane1",
    "ไฟสัญญาณเตือน": "light1", "ไฟสัญญาณ": "light1", "ไฟสัญญาน": "light1", "ไฟเตือน 1": "light1", "ไฟเตือน1": "light1", "ไฟเตือน": "light1", "ไฟอลาร์ม": "light1", "tower light": "light1", "light 1": "light1", "light1": "light1", "ไฟหมุน": "light1", "ไฟกระพริบ": "light1",
    "เครื่องทำความเย็น 1": "chiller1", "ชิลเลอร์ 1": "chiller1", "ชิลเลอร์1": "chiller1", "ชิลเลอร์": "chiller1", "chiller 1": "chiller1", "chiller1": "chiller1", "ชิเลอร์": "chiller1", "แอร์": "chiller1",
    "ทุกเครื่อง": "all", "ทุกอย่าง": "all", "ทั้งหมด": "all", "ระบบ": "all", "ทุกตัว": "all", "เครื่องจักรทั้งหมด": "all", "ทุก": "all", "all": "all"
  };

  // 3. ตรวจ action aliases (built-in + custom)
  const allActionAliases = {
    ...vocab.actionAliases,
    "หยุดฉุกเฉิน": "emergency_stop", "ดับฉุกเฉิน": "emergency_stop", "ฉุกเฉิน": "emergency_stop", "emergency stop": "emergency_stop", "emergency": "emergency_stop", "estop": "emergency_stop", "e-stop": "emergency_stop", "หยุดด่วน": "emergency_stop", "อันตราย": "emergency_stop", "หยุดทันที": "emergency_stop",
    "รีเซ็ต": "reset", "รีเซต": "reset", "reset": "reset", "เริ่มต้นใหม่": "reset", "เริ่มใหม่": "reset", "ค่าเริ่มต้น": "reset", "ล้างค่า": "reset", "คืนค่า": "reset",
    "ตั้งความเร็ว": "set_speed", "ปรับความเร็ว": "set_speed", "เร่งความเร็ว": "set_speed", "ลดความเร็ว": "set_speed", "เพิ่มความเร็ว": "set_speed", "ความเร็ว": "set_speed", "สปีด": "set_speed", "speed": "set_speed", "ระดับ": "set_speed",
    "ตั้งอุณหภูมิ": "set_speed", "ปรับอุณหภูมิ": "set_speed", "ตั้งความร้อน": "set_speed", "ปรับความร้อน": "set_speed", "ตั้งแรงดัน": "set_speed", "ปรับแรงดัน": "set_speed", "ตั้งความสว่าง": "set_speed", "ปรับความสว่าง": "set_speed", "ตั้งความเย็น": "set_speed", "ปรับความเย็น": "set_speed",
    "ตั้ง": "set_speed", "ปรับ": "set_speed", "เร่ง": "set_speed", "ลด": "set_speed", "เพิ่ม": "set_speed", "ยก": "set_speed", "หมุน": "set_speed", "เซ็ต": "set_speed", "ตั่ง": "set_speed",
    "หยุดเดิน": "stop", "หยุดทำงาน": "stop", "ดับเครื่อง": "stop", "ปิดเครื่อง": "stop", "หยุด": "stop", "stop": "stop", "off": "stop", "ปิด": "stop", "ดับ": "stop", "พัก": "stop", "พักเครื่อง": "stop", "ยกเลิก": "stop", "ปิดระบบ": "stop", "หยุถ": "stop", "หยด": "stop",
    "สตาร์ทเครื่อง": "start", "สตาร์ท": "start", "เริ่มเดิน": "start", "เริ่มทำงาน": "start", "เดินเครื่อง": "start", "เปิดเครื่อง": "start", "ทำงาน": "start", "ให้ทำงาน": "start", "เปิดระบบ": "start", "เริ่ม": "start", "เปิด": "start", "start": "start", "on": "start", "เดิน": "start", "รัน": "start", "run": "start", "go": "start", "ติด": "start", "ปล่อย": "start", "สตาท": "start", "สตาต": "start", "เปด": "start", "เปิต": "start"
  };

  // หา device (longest match ก่อน)
  let foundDevice = null;
  const deviceKeys = Object.keys(allDeviceAliases).sort((a, b) => b.length - a.length);
  for (const key of deviceKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundDevice = allDeviceAliases[key];
      break;
    }
  }

  // หา action (longest match ก่อน)
  let foundAction = "chat";
  const actionKeys = Object.keys(allActionAliases).sort((a, b) => b.length - a.length);
  for (const key of actionKeys) {
    if (lower.includes(key.toLowerCase())) {
      foundAction = allActionAliases[key];
      break;
    }
  }

  // ถ้าเจอ device และ action ไม่ใช่ chat → ผ่าน vocab match
  if (foundDevice && foundAction !== "chat") {
    const params = {};
    const textForSpeed = lower.replace(foundDevice, "");

    const allNums = [...textForSpeed.matchAll(/(\d+)/g)].map(m => parseInt(m[1], 10));
    let speedVal = allNums.length > 0 ? allNums[allNums.length - 1] : null;

    if (speedVal === null) {
      if (/เต็มที่|เต็มร้อย|สูงสุด|สุดๆ|สุดกำลัง|ร้อยเปอร์เซ็น|แม็กซ์|แม็ก|แรงสุด|ร้อยเปอ|เต็มแม็ก|เต็มพิกัด/.test(textForSpeed)) speedVal = 100;
      else if (/ครึ่งนึง|ครึ่งหนึ่ง|ห้าสิบ/.test(textForSpeed)) speedVal = 50;
      else if (/เบาๆ|นิดเดียว|ต่ำสุด|น้อยสุด|ช้าๆ/.test(textForSpeed)) speedVal = 20;
    }

    if (speedVal !== null && speedVal >= 0 && speedVal <= 100) {
      params.speed = speedVal;
      if (foundAction === "start" || foundAction === "chat") foundAction = "set_speed";
    }

    return {
      success: true,
      data: {
        device: foundDevice,
        action: foundAction,
        params,
        message: `[Vocab Match] ${foundAction} ${foundDevice}${params.speed !== undefined ? ` ${params.speed}%` : ""}`,
        model: "vocab-match",
        source: "vocab_pre_match",
        confidence: 1.0
      }
    };
  }

  return null;
}

// ─── Compound Command Parser — แยกคำสั่งหลายเครื่อง ────────────
function parseCompoundCommands(message) {
  const lower = message.toLowerCase().trim();

  // Regex สำหรับแยกคำสั่งที่เชื่อมด้วย " และ ", " ด้วย ", " กับ "
  const compoundRegex = /(.+?)(?:\s*(?:และ|กับ|,)\s*)(.+?)(?=หยุด|ปิด|เปิด|ตั้ง|ปรับ|เร่ง|ลด|เพิ่ม|รีเซ็ต|สตาร์ท)/i;

  // ถ้ามี device หลายตัว + action เดียว → สันนิษฐานว่าเป็น compound
  const multiDevicePattern = /(?:สายพาน.*(?:สายพาน|ไลน์)|มอเตอร์.*มอเตอร์|ปั๊ม.*ปั๊ม|พัดลม.*พัดลม|ฮีตเตอร์.*ฮีตเตอร์|คอมเพรสเซอร์.*คอมเพรสเซอร์)/i;

  if (multiDevicePattern.test(lower)) {
    // สันนิษฐานว่าเป็น compound command — แยกเป็นหลายคำสั่ง
    return "compound";
  }

  return null;
}

// ─── Parse Command หลัก ───────────────────────────────────────
async function parseCommand(userMessage, forceModel = null) {
  // Level 2: Vocab Pre-match — ตรวจก่อนเรียก AI
  const vocabResult = vocabPreMatch(userMessage);
  if (vocabResult) {
    console.log(`✅ Vocab pre-match: ${vocabResult.data.message}`);
    return vocabResult;
  }

  // Level 3a: Fuzzy Search — ตรวจคำผิดก่อนเรียก AI
  const fuzzyResult = vocabService.fuzzySearch(userMessage);
  if (fuzzyResult && fuzzyResult.device && fuzzyResult.action && fuzzyResult.confidences.device >= 0.6) {
    console.log(`✅ Fuzzy pre-match (${(fuzzyResult.confidences.device * 100).toFixed(0)}%): ${fuzzyResult.action} ${fuzzyResult.device}`);
    return {
      success: true,
      data: {
        device: fuzzyResult.device,
        action: fuzzyResult.action,
        params: {},
        message: `[Fuzzy Match] ${fuzzyResult.action} ${fuzzyResult.device} (confidence: ${(fuzzyResult.confidences.device * 100).toFixed(0)}%)`,
        model: "fuzzy-match",
        source: "fuzzy_pre_match",
        confidence: fuzzyResult.confidences.device,
        fuzzy: true
      }
    };
  }

  // Level 3b: Check compound commands
  const isCompound = parseCompoundCommands(userMessage);
  if (isCompound === "compound") {
    console.log("📦 Detected compound command — sending to AI for parsing");
  }

  // ไม่ผ่าน vocab/fuzzy match → เรียก AI พร้อม Context
  const context = getContext();
  try {
    const selectedModel = await getModelName(forceModel);
    if (!selectedModel) throw new Error("ไม่พบ model ใน Ollama");

    console.log(`🤖 Using model: ${selectedModel}${forceModel ? " (user selected)" : " (auto)"}`);

    let systemPrompt = getSystemPrompt();

    // เพิ่ม context ถ้ามี
    if (context) {
      systemPrompt += `\n\n═══════════════════════════════════════\nCONTEXT (last command):\nLast device: ${context.device}, Last action: ${context.action}\nIf user sends short command like "เปิด" or "ปิด" without device, use the same device as context.\n═══════════════════════════════════════`;
    }

    const response = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
        format: "json",
        keep_alive: KEEP_ALIVE,
        options: { temperature: 0, num_predict: 80, num_ctx: 512 }
      },
      { timeout: 60000 }
    );

    const rawContent = response?.data?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      throw new Error("AI ตอบกลับเป็นค่าว่าง");
    }

    const content = rawContent.trim();
    console.log(`📨 AI raw response: ${content}`);

    // Extract JSON แรกเสมอ (ป้องกัน AI ตอบหลาย JSON)
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) throw new Error("AI ไม่ได้ตอบเป็น JSON");

    const firstClose = findMatchingClose(content, firstBrace);
    if (firstClose === -1) throw new Error("JSON ไม่สมบูรณ์");

    let parsed = JSON.parse(content.slice(firstBrace, firstClose + 1));

    // ─── Post-processing: แก้ปัญหา Llama 3.2 มั่วชื่อ device ──
    const validDevices = ["conveyor1", "conveyor2", "motor1", "pump1", "fan1", "robot1", "agv1", "heater1", "compressor1", "crane1", "light1", "chiller1", "all"];

    if (parsed.device && !validDevices.includes(parsed.device)) {
      console.warn(`⚠️ AI Hallucinated device: ${parsed.device} -> Trying Fallback`);
      const searchResult = vocabService.searchVocab(userMessage);
      if (searchResult && searchResult.found) {
        parsed.device = searchResult.device;
        parsed.confidence = Math.max(parsed.confidence || 0.5, 0.8);
        console.log(`✅ Corrected device to: ${parsed.device}`);
      } else {
        parsed.device = null;
        parsed.action = "chat";
        parsed.confidence = Math.min(parsed.confidence || 0.3, 0.4);
        parsed.message = `⚠️ ไม่เข้าใจชื่ออุปกรณ์ "${parsed.device}" กรุณาลองใหม่ หรือเพิ่มคำใน 📚 คลังคำสั่ง`;
      }
    }

    // ─── เพิ่ม/ปรับ confidence score ──────────────────────────────
    const safeResult = {
      device: parsed.device || null,
      action: parsed.action || "chat",
      params: (parsed.params && typeof parsed.params === "object") ? parsed.params : {},
      message: parsed.message || `ได้รับคำสั่ง: ${userMessage}`,
      model: selectedModel,
      source: "ollama",
      confidence: parsed.confidence || (parsed.device ? 0.85 : 0.3)
    };

    // ─── ตรวจค่า speed เป็นตัวเลขจริง ──────────────────────────────
    if (safeResult.params.speed !== undefined) {
      const spd = parseInt(safeResult.params.speed, 10);
      safeResult.params.speed = isNaN(spd) ? 50 : Math.max(0, Math.min(100, spd));
    } else {
      // ดึง speed จากคำพูดถ้า AI ไม่ทำ
      const txt = userMessage.toLowerCase();
      if (/เต็มที่|เต็มร้อย|สูงสุด|สุดๆ|สุดกำลัง|ร้อยเปอร์เซ็น|แม็กซ์|แม็ก|แรงสุด|ร้อยเปอ|เต็มแม็ก|เต็มพิกัด/.test(txt)) {
        safeResult.params.speed = 100;
        if (safeResult.action === "chat") safeResult.action = "set_speed";
      } else if (/ครึ่งนึง|ครึ่งหนึ่ง|ห้าสิบ/.test(txt)) {
        safeResult.params.speed = 50;
        if (safeResult.action === "chat") safeResult.action = "set_speed";
      } else if (/เบาๆ|นิดเดียว|ต่ำสุด|น้อยสุด|ช้าๆ/.test(txt)) {
        safeResult.params.speed = 20;
        if (safeResult.action === "chat") safeResult.action = "set_speed";
      }
    }

    // ─── Context Update ────────────────────────────────────────────
    if (safeResult.device && safeResult.action !== "chat") {
      updateContext(safeResult.device, safeResult.action);
    }

    // ─── Confidence-based message adjustment ──────────────────────
    if (safeResult.confidence < 0.6) {
      safeResult.message += " ⚠️ (ไม่แน่ใจ lắm กรุณาตรวจสอบ)";
    } else if (safeResult.confidence >= 0.9) {
      // confidence สูง → ยืนยันชัดเจน
      safeResult.message = safeResult.message.replace("⚠️", "");
    }

    return { success: true, data: safeResult };

  } catch (error) {
    console.error("Ollama error:", error.message);
    return fallbackParse(userMessage);
  }
}

// Helper: หา index ปิด } ที่ match กับ {
function findMatchingClose(str, start) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Rule-based fallback — ใช้ vocabularyService + Fuzzy Match
function fallbackParse(message) {
  try {
    const vocabResult = vocabService.searchVocab(message);
    if (vocabResult && vocabResult.found) {
      return {
        success: true,
        data: {
          device: vocabResult.device || null,
          action: vocabResult.action || "chat",
          params: vocabResult.params || {},
          message: vocabResult.message || `พบคำสั่ง: ${message}`,
          model: `fallback:${vocabResult.source || 'unknown'}`,
          source: "fallback",
          confidence: vocabResult.confidence || (vocabResult.fuzzy ? 0.7 : 1.0),
          fuzzy: !!vocabResult.fuzzy
        }
      };
    }
  } catch (err) {
    console.error("Fallback parse error:", err.message);
  }

  return {
    success: true,
    data: {
      device: null,
      action: "chat",
      params: {},
      message: "⚠️ ไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ใหม่ หรือเพิ่มคำใน 📚 คลังคำสั่ง",
      model: "fallback:no-match",
      source: "fallback",
      confidence: 0.1
    }
  };
}

async function getAvailableModels() {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    return res.data.models || [];
  } catch { return []; }
}

async function checkOllamaHealth() {
  try {
    await axios.get(`${OLLAMA_URL}/`, { timeout: 3000 });
    return true;
  } catch { return false; }
}

module.exports = { parseCommand, getAvailableModels, checkOllamaHealth, warmUp };