// ============================================================
// Ollama AI Service - แปลงภาษาธรรมชาติ → JSON Command
// รองรับ Vocabulary แบบ dynamic
// ============================================================

const axios = require("axios");
const vocabService = require("./vocabularyService");

const OLLAMA_URL = "http://10.80.84.24:11434";

// ─── Model Cache (TTL 5 นาที) ─────────────────────────────────
let _modelCache = {
  name: null,
  fetchedAt: 0,
  TTL: 5 * 60 * 1000  // 5 นาที
};

// ─── System Prompt Cache ──────────────────────────────────────
let _cachedPrompt = null;

// ─── ลด tokens — JSON response สั้น ไม่ต้องการ 200 tokens ────
const NUM_PREDICT = 100;
// บอก Ollama ให้เก็บ model ไว้ใน memory 30 นาที (ป้องกัน cold-start)
const KEEP_ALIVE  = "30m";

// ─── ดึง model name (จาก cache หรือ fetch ใหม่) ───────────────
async function getModelName(forceModel = null) {
  const now = Date.now();
  const expired = now - _modelCache.fetchedAt > _modelCache.TTL;

  if (!forceModel && _modelCache.name && !expired) {
    return _modelCache.name; // ใช้ cache ทันที ไม่ต้อง network call
  }

  try {
    const modelsRes = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const models = modelsRes.data.models || [];

    let selected = null;
    if (forceModel) {
      const found = models.find(m => m.name === forceModel);
      if (found) selected = found.name;
      else console.warn(`⚠️ Model "${forceModel}" ไม่พบ, ใช้ auto-detect`);
    }
    if (!selected) {
      const preferred = ["qwen", "gemma", "llama", "mistral", "phi"];
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
    return _modelCache.name || null; // fallback ใช้ cache เดิมถ้ามี
  }
}

// ─── Build system prompt (cached — rebuild เฉพาะเมื่อ vocab เปลี่ยน) ─
function getSystemPrompt() {
  // ตรวจว่า vocab ถูกแก้ไขหรือยัง (ถ้าเป็น ครั้งแรก หรือ vocab เปลี่ยน)
  if (_cachedPrompt && !vocabService.isPromptDirty()) {
    return _cachedPrompt; // ใช้ cache
  }

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

  _cachedPrompt = `คุณคือ AI ผู้ช่วยควบคุมเครื่องจักรในโรงงาน
หน้าที่คือแปลงคำสั่งภาษาไทยหรืออังกฤษเป็น JSON Command เดียวเท่านั้น

อุปกรณ์ในระบบ:
- conveyor1: สายพาน 1
- conveyor2: สายพาน 2
- motor1: มอเตอร์หลัก
- pump1: ปั๊มน้ำหล่อเย็น
- fan1: พัดลมระบายความร้อน
- robot1: หุ่นยนต์แขนกล
- agv1: รถ AGV ลำเลียง
- heater1: ฮีตเตอร์เตาอบ
- compressor1: เครื่องปั๊มลม
- crane1: เครนยกสินค้า
- light1: ไฟสัญญาณเตือน
- chiller1: เครื่องทำความเย็น

Actions: start|stop|set_speed(params.speed:0-100)|emergency_stop|reset

ชื่อเรียกอื่น ๆ ของอุปกรณ์:
${deviceAliasList || "  (ยังไม่มี)"}

ชื่อเรียกอื่น ๆ ของ action:
${actionAliasList || "  (ยังไม่มี)"}

คำสั่งลัดที่กำหนดเอง:
${customCmdList || "  (ยังไม่มี)"}

กฎ: ตอบ JSON เดียว ห้ามมีข้อความอื่น
รูปแบบ: {"device":"id","action":"action","params":{},"message":"ข้อความไทย"}
ถ้าไม่ใช่คำสั่งควบคุม: {"device":null,"action":"chat","message":"ตอบกลับ"}

ตัวอย่าง:
"เปิดสายพาน 1" → {"device":"conveyor1","action":"start","params":{},"message":"เปิดสายพาน 1 แล้ว"}
"หยุดมอเตอร์" → {"device":"motor1","action":"stop","params":{},"message":"หยุดมอเตอร์แล้ว"}
"ตั้งพัดลม 80%" → {"device":"fan1","action":"set_speed","params":{"speed":80},"message":"ตั้งพัดลม 80%"}`;

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

// ─── Parse Command หลัก ───────────────────────────────────────
async function parseCommand(userMessage, forceModel = null) {
  try {
    const selectedModel = await getModelName(forceModel);
    if (!selectedModel) throw new Error("ไม่พบ model ใน Ollama");

    console.log(`🤖 Using model: ${selectedModel}${forceModel ? " (user selected)" : " (auto)"}`);

    const systemPrompt = getSystemPrompt();

    const response = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage  }
        ],
        stream: false,
        format: "json",
        keep_alive: KEEP_ALIVE,
        options: { temperature: 0.1, num_predict: 40, num_ctx: 512 }
      },
      { timeout: 60000 }
    );

    const content = response.data.message.content.trim();
    console.log(`📨 AI raw response: ${content}`);

    // Extract JSON แรกเสมอ (ป้องกัน AI ตอบหลาย JSON)
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) throw new Error("AI ไม่ได้ตอบเป็น JSON");

    const firstClose = findMatchingClose(content, firstBrace);
    if (firstClose === -1) throw new Error("JSON ไม่สมบูรณ์");

    const parsed = JSON.parse(content.slice(firstBrace, firstClose + 1));
    parsed.model  = selectedModel;
    parsed.source = "ollama";
    return { success: true, data: parsed };

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

// Rule-based fallback — ใช้ vocabularyService
function fallbackParse(message) {
  const vocabResult = vocabService.searchVocab(message);
  if (vocabResult.found) {
    return {
      success: true,
      data: {
        device:  vocabResult.device,
        action:  vocabResult.action,
        params:  vocabResult.params || {},
        message: vocabResult.message,
        model:   `fallback:${vocabResult.source}`
      }
    };
  }

  return {
    success: true,
    data: {
      device:  null,
      action:  "chat",
      message: "⚠️ ไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ใหม่ หรือเพิ่มคำใน 📚 คลังคำสั่ง",
      model:   "fallback:no-match"
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
