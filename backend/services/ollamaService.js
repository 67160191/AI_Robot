// ============================================================
// Ollama AI Service - แปลงภาษาธรรมชาติ → JSON Command
// รองรับ Vocabulary แบบ dynamic
// ============================================================

const axios = require("axios");
const vocabService = require("./vocabularyService");

const OLLAMA_URL = "http://localhost:11434";

// Build system prompt รวม custom vocab
function buildSystemPrompt() {
  const vocab = vocabService.getAll();

  // รวม alias เป็น text สำหรับ AI
  const deviceAliasList = Object.entries(vocab.deviceAliases)
    .map(([alias, id]) => `  "${alias}" → ${id}`)
    .join("\n");

  const actionAliasList = Object.entries(vocab.actionAliases)
    .map(([alias, act]) => `  "${alias}" → ${act}`)
    .join("\n");

  const customCmdList = vocab.customCommands
    .map(c => `  "${c.phrase}" → device:${c.device} action:${c.action}${c.params?.speed ? ` speed:${c.params.speed}` : ""}`)
    .join("\n");

  return `คุณคือ AI ผู้ช่วยควบคุมเครื่องจักรในโรงงาน
หน้าที่คือแปลงคำสั่งภาษาไทยหรืออังกฤษเป็น JSON Command เดียวเท่านั้น

อุปกรณ์ในระบบ:
- conveyor1: สายพาน 1
- conveyor2: สายพาน 2
- motor1: มอเตอร์หลัก
- pump1: ปั๊มน้ำหล่อเย็น
- fan1: พัดลมระบายความร้อน
- robot1: หุ่นยนต์แขนกล

Actions:
- start: เปิด/เดิน
- stop: หยุด/ปิด
- set_speed: ตั้งความเร็ว (params.speed: 0-100)
- emergency_stop: หยุดฉุกเฉิน
- reset: รีเซ็ต

ชื่อเรียกอื่น ๆ ของอุปกรณ์ (device aliases):
${deviceAliasList || "  (ยังไม่มี)"}

ชื่อเรียกอื่น ๆ ของ action (action aliases):
${actionAliasList || "  (ยังไม่มี)"}

คำสั่งลัดที่กำหนดเอง:
${customCmdList || "  (ยังไม่มี)"}

กฎสำคัญ:
1. ตอบด้วย JSON object เดียวเท่านั้น ห้ามตอบหลาย JSON ห้ามมีข้อความอื่นนอก JSON
2. รูปแบบ: {"device":"device_id","action":"action","params":{},"message":"ข้อความภาษาไทย"}
3. ถ้าคำสั่งครอบคลุมหลายอุปกรณ์ ให้เลือกอุปกรณ์หลักที่สำคัญที่สุด 1 ตัว
4. ถ้าไม่ใช่คำสั่งควบคุม: {"device":null,"action":"chat","message":"ข้อความตอบกลับ"}
5. ใช้ชื่อเรียกอื่น ๆ ในการแปลคำสั่งด้วย

ตัวอย่าง:
- "เปิดสายพาน 1" → {"device":"conveyor1","action":"start","params":{},"message":"เปิดสายพาน 1 แล้ว"}
- "หยุดมอเตอร์" → {"device":"motor1","action":"stop","params":{},"message":"หยุดมอเตอร์แล้ว"}
- "ตั้งพัดลม 80%" → {"device":"fan1","action":"set_speed","params":{"speed":80},"message":"ตั้งพัดลม 80%"}
- "ปรับทุกอย่างเต็มที่" → {"device":"motor1","action":"set_speed","params":{"speed":100},"message":"ตั้งความเร็วสูงสุด"}`;
}

async function parseCommand(userMessage, forceModel = null) {
  try {
    const modelsRes = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const models = modelsRes.data.models || [];

    let selectedModel = null;

    if (forceModel) {
      const found = models.find(m => m.name === forceModel);
      if (found) selectedModel = found.name;
      else console.warn(`⚠️ Model "${forceModel}" ไม่พบ, ใช้ auto-detect แทน`);
    }

    if (!selectedModel) {
      const preferred = ["qwen", "gemma", "llama", "mistral", "phi"];
      for (const pref of preferred) {
        const found = models.find(m => m.name.toLowerCase().includes(pref));
        if (found) { selectedModel = found.name; break; }
      }
      if (!selectedModel && models.length > 0) selectedModel = models[0].name;
    }

    if (!selectedModel) throw new Error("ไม่พบ model ใน Ollama");

    console.log(`🤖 Using model: ${selectedModel}${forceModel ? " (user selected)" : " (auto)"}`);

    // Build prompt แบบ dynamic (รวม vocab)
    const systemPrompt = buildSystemPrompt();

    const response = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 200 }
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
    parsed.model = selectedModel;
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
  // ลองค้นหาจาก vocab ก่อน
  const vocabResult = vocabService.searchVocab(message);
  if (vocabResult.found) {
    return {
      success: true,
      data: {
        device: vocabResult.device,
        action: vocabResult.action,
        params: vocabResult.params || {},
        message: vocabResult.message,
        model: `fallback:${vocabResult.source}`
      }
    };
  }

  return {
    success: true,
    data: {
      device: null,
      action: "chat",
      message: "⚠️ ไม่เข้าใจคำสั่งนี้ กรุณาลองพิมพ์ใหม่ หรือเพิ่มคำใน 📚 คลังคำสั่ง",
      model: "fallback:no-match"
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

module.exports = { parseCommand, getAvailableModels, checkOllamaHealth };
