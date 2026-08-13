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
หน้าที่: แปลงคำสั่งภาษาไทยหรืออังกฤษ → JSON เดียว ห้ามตอบข้อความอื่น

อุปกรณ์ในระบบ (device id):
- conveyor1: สายพาน 1
- conveyor2: สายพาน 2
- motor1: มอเตอร์หลัก
- pump1: ปั๊มน้ำหล่อเย็น
- fan1: พัดลมระบายความร้อน
- robot1: หุ่นยนต์แขนกล
- agv1: รถ AGV
- heater1: ฮีตเตอร์เตาอบ
- compressor1: เครื่องปั๊มลม
- crane1: เครนยกสินค้า
- light1: ไฟสัญญาณเตือน
- chiller1: เครื่องทำความเย็น
- all: ทั้งระบบ / ทุกเครื่องจักร

Actions ที่ใช้ได้: start | stop | set_speed | emergency_stop | reset

ชื่อเรียกอื่น ๆ ของอุปกรณ์:
${deviceAliasList || "  (ยังไม่มี)"}

ชื่อเรียกอื่น ๆ ของ action:
${actionAliasList || "  (ยังไม่มี)"}

คำสั่งลัดที่กำหนดเอง:
${customCmdList || "  (ยังไม่มี)"}

กฎสำคัญ:
1. ตอบเป็น JSON เดียว ห้ามมีข้อความอื่นนอก JSON
2. รูปแบบ: {"device":"<id>","action":"<action>","params":{},"message":"<ข้อความยืนยันภาษาไทย>"}
3. ถ้าไม่ใช่คำสั่งควบคุม: {"device":null,"action":"chat","params":{},"message":"<ตอบกลับ>"}
4. ค่าความเร็ว (params.speed): ดึงตัวเลขจากคำสั่ง เช่น "80%" หรือ "80" ให้ speed=80
   - ถ้ามีชื่ออุปกรณ์มีเลข เช่น "สายพาน 1" ให้ใช้เลขหลัง (80) ไม่ใช่เลขในชื่ออุปกรณ์ (1)
   - ถ้ามีคำว่า "เต็มที่", "เต็มร้อย", "สูงสุด", "เต็มพิกัด" ให้ speed=100
   - ถ้ามีคำว่า "ครึ่งหนึ่ง", "ครึ่งนึง", "ห้าสิบ" ให้ speed=50
   - ตัวอย่าง: "สายพาน 1 ความเร็ว 80" → speed=80 (ไม่ใช่ 1)
5. ระบุ device id ให้ตรงที่สุด (conveyor1 vs conveyor2)

ตัวอย่าง:
"เปิดสายพาน 1" → {"device":"conveyor1","action":"start","params":{},"message":"เปิดสายพาน 1 แล้ว"}
"หยุดมอเตอร์" → {"device":"motor1","action":"stop","params":{},"message":"หยุดมอเตอร์แล้ว"}
"ตั้งพัดลม 80%" → {"device":"fan1","action":"set_speed","params":{"speed":80},"message":"ตั้งพัดลม 80%"}
"สายพาน 1 ความเร็ว 80" → {"device":"conveyor1","action":"set_speed","params":{"speed":80},"message":"ตั้งความเร็วสายพาน 1 เป็น 80%"}
"สายพาน 2 ปรับความเร็ว 60" → {"device":"conveyor2","action":"set_speed","params":{"speed":60},"message":"ตั้งความเร็วสายพาน 2 เป็น 60%"}
"ปิดสายพาน 2" → {"device":"conveyor2","action":"stop","params":{},"message":"ปิดสายพาน 2 แล้ว"}
"ปิดเครื่องจักรทุกตัว" → {"device":"all","action":"stop","params":{},"message":"ปิดเครื่องจักรทั้งหมดแล้ว"}
"หยุดฉุกเฉิน" → {"device":"all","action":"emergency_stop","params":{},"message":"หยุดฉุกเฉินทุกเครื่อง"}`;


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

    const parsed = JSON.parse(content.slice(firstBrace, firstClose + 1));

    // รับประกันว่า parsed มีค่าที่จำเป็นครบถ้วน
    const safeResult = {
      device:  parsed.device || null,
      action:  parsed.action || "chat",
      params:  (parsed.params && typeof parsed.params === "object") ? parsed.params : {},
      message: parsed.message || `ได้รับคำสั่ง: ${userMessage}`,
      model:   selectedModel,
      source:  "ollama"
    };

    // ตรวจค่า speed เป็นตัวเลขจริง
    if (safeResult.params.speed !== undefined) {
      const spd = parseInt(safeResult.params.speed, 10);
      safeResult.params.speed = isNaN(spd) ? 50 : Math.max(0, Math.min(100, spd));
    } else {
      // ถ้า AI ลืมส่ง speed มา ให้ลองดึงจากคำพูด
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

// Rule-based fallback — ใช้ vocabularyService
function fallbackParse(message) {
  try {
    const vocabResult = vocabService.searchVocab(message);
    if (vocabResult && vocabResult.found) {
      return {
        success: true,
        data: {
          device:  vocabResult.device || null,
          action:  vocabResult.action || "chat",
          params:  vocabResult.params || {},
          message: vocabResult.message || `พบคำสั่ง: ${message}`,
          model:   `fallback:${vocabResult.source || 'unknown'}`,
          source:  "fallback"
        }
      };
    }
  } catch (err) {
    console.error("Fallback parse error:", err.message);
  }

  return {
    success: true,
    data: {
      device:  null,
      action:  "chat",
      params:  {},
      message: "⚠️ ไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ใหม่ หรือเพิ่มคำใน 📚 คลังคำสั่ง",
      model:   "fallback:no-match",
      source:  "fallback"
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
