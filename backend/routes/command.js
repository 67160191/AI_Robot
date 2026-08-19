// ============================================================
// Command Route - /api/command
// แยก Parse (AI) ออกจาก Execute (ต้องยืนยัน) อย่างชัดเจน
// ============================================================

const express = require("express");
const router  = express.Router();
const ollamaService    = require("../services/ollamaService");
const mqttService      = require("../services/mqttService");
const machineState     = require("../services/machineState");
const historyService   = require("../services/historyService");
const vocabService     = require("../services/vocabularyService");
const gatewayService   = require("../services/gatewayService");
const factoryIoService = require("../services/factoryIoService");

// ─────────────────────────────────────────────────────────
// POST /api/command — Parse เท่านั้น (ไม่ execute)
// Frontend แสดง confirm → ถ้า confirm ค่อย call /execute
// ─────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { message, model: requestedModel } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "กรุณาระบุคำสั่ง" });

    console.log(`\n📩 Parse command: "${message}" | model: ${requestedModel || "auto"}`);

    // ── ⚡ Vocab-First: ตรวจ vocab ก่อน ส่งไป AI ──────────────────
    // ถ้า match → return ทันที (~0ms) ไม่ต้องเรียก Ollama เลย
    const vocabResult = vocabService.searchVocab(message);
    if (vocabResult && vocabResult.found && (vocabResult.source === "custom_command" || vocabResult.confidence === 1)) {
      console.log(`⚡ Custom Command match: ${vocabResult.device} / ${vocabResult.action}`);
      const record = historyService.add({
        userMessage: message,
        aiMessage:   vocabResult.message || `${vocabResult.action} ${vocabResult.device}`,
        device:      vocabResult.device,
        action:      vocabResult.action,
        params:      vocabResult.params || {},
        model:       `vocab:${vocabResult.source}`,
        source:      "vocab",
        executed:    false,
        success:     null
      });
      return res.json({
        id:          record.id,
        userMessage: message,
        aiMessage:   vocabResult.message || `${vocabResult.action} ${vocabResult.device}`,
        device:      vocabResult.device,
        action:      vocabResult.action,
        params:      vocabResult.params || {},
        model:       `vocab:${vocabResult.source}`,
        source:      "vocab",
        timestamp:   record.timestamp
      });
    }
    // ────────────────────────────────────────────────────────────

    const aiResult = await ollamaService.parseCommand(message, requestedModel || null);
    if (!aiResult || !aiResult.success) {
      return res.status(500).json({ error: "AI ประมวลผลไม่ได้", details: aiResult?.error || "unknown" });
    }

    const data = aiResult.data || {};
    const { device, action, params, message: aiMessage, model, source } = data;

    // บันทึก history (ยังไม่ execute)
    const record = historyService.add({
      userMessage: message,
      aiMessage:   aiMessage || `${action || 'chat'} ${device || ''}`.trim(),
      device:      device || null,
      action:      action || "chat",
      params:      params || {},
      model:       model || "unknown",
      source:      source || "ai",
      executed:    false,
      success:     null
    });

    res.json({
      id: record.id,
      userMessage: message,
      aiMessage:   aiMessage || `${action || 'chat'} ${device || ''}`.trim(),
      device:      device || null,
      action:      action || "chat",
      params:      params || {},
      model:       model || "unknown",
      source:      source || "ai",
      timestamp:   record.timestamp
    });
  } catch (err) {
    console.error("❌ POST /api/command unhandled error:", err);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดภายในระบบ",
      details: err.message || "unknown"
    });
  }
});


// ─────────────────────────────────────────────────────────
// POST /api/command/execute — Execute จริง (หลัง user confirm)
// ─────────────────────────────────────────────────────────
router.post("/execute", async (req, res) => {
  const { id, device, action, params = {}, userMessage = "" } = req.body;

  if (!device || !action) {
    return res.status(400).json({ error: "ต้องระบุ device และ action" });
  }

  console.log(`\n✅ Execute: device=${device} action=${action} params=${JSON.stringify(params)}`);

  const machineResult = machineState.execute(device, action, params);
  const mqttResult    = mqttService.publish(device, action, params);
  
  // ซิงค์สถานะไปที่ Factory I/O (Modbus)
  if (action === "start" || action === "on" || (action === "set_speed" && params.speed > 0)) {
    factoryIoService.writeDeviceState(device, true);
  } else if (action === "stop" || action === "off" || (action === "set_speed" && params.speed === 0)) {
    factoryIoService.writeDeviceState(device, false);
  }

  const gatewayLog    = gatewayService.recordGatewayTransaction({
    device, action, params, userMessage: userMessage || `[Execute] ${action} ${device}`, source: "ai"
  });

  // อัพเดต history record ถ้ามี id
  if (id) {
    historyService.updateExecuted(id, machineResult);
  }

  console.log(`⚙️ Machine result:`, machineResult);

  res.json({
    device,
    action,
    params,
    machineResult,
    mqttStatus: mqttService.getStatus(),
    gatewayLog,
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/command/direct — Quick Buttons (ไม่ผ่าน AI)
// ─────────────────────────────────────────────────────────
router.post("/direct", async (req, res) => {
  const { device, action, params = {} } = req.body;
  if (!device || !action) return res.status(400).json({ error: "ต้องระบุ device และ action" });

  const machineResult = machineState.execute(device, action, params);
  const mqttResult    = mqttService.publish(device, action, params);
  
  // ซิงค์สถานะไปที่ Factory I/O (Modbus)
  if (action === "start" || action === "on" || (action === "set_speed" && params.speed > 0)) {
    factoryIoService.writeDeviceState(device, true);
  } else if (action === "stop" || action === "off" || (action === "set_speed" && params.speed === 0)) {
    factoryIoService.writeDeviceState(device, false);
  }

  const gatewayLog    = gatewayService.recordGatewayTransaction({
    device, action, params, userMessage: `[Quick] ${action} ${device}`, source: "direct"
  });

  const record = historyService.add({
    userMessage: `[Quick] ${action} ${device}`,
    aiMessage: machineResult.message,
    device, action, params,
    model: "direct",
    source: "direct",
    executed: true,
    success: machineResult.success
  });

  res.json({
    id: record.id,
    device, action,
    machineResult,
    mqttStatus: mqttService.getStatus(),
    gatewayLog,
    timestamp: record.timestamp
  });
});

// GET /api/command/status
router.get("/status", (req, res) => {
  res.json({
    machines: machineState.getAll(),
    mqtt: mqttService.getStatus(),
    gateway: gatewayService.getConfig()
  });
});

// GET /api/command/history
router.get("/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(historyService.getAll(limit));
});

// GET /api/command/models
router.get("/models", async (req, res) => {
  const models = await ollamaService.getAvailableModels();
  const health  = await ollamaService.checkOllamaHealth();
  res.json({ health, models });
});

// ─────────────────────────────────────────────────────────
// GATEWAY Endpoints
// ─────────────────────────────────────────────────────────
router.get("/gateway/status", (req, res) => {
  res.json(gatewayService.getConfig());
});

router.get("/gateway/logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json(gatewayService.getLogs(limit));
});

router.get("/gateway/explainer", (req, res) => {
  res.json(gatewayService.getPlcExplainer());
});

// ─────────────────────────────────────────────────────────
// PLC SIMULATOR Endpoints (Multi-PLC Support)
// ─────────────────────────────────────────────────────────
router.get("/plc/status", (req, res) => {
  res.json(gatewayService.getSimPLCs());
});

router.get("/plc/telemetry/:plcId", (req, res) => {
  const telemetry = gatewayService.getSimPLCTelemetry(req.params.plcId);
  if (!telemetry) return res.status(404).json({ error: "PLC not found" });
  res.json(telemetry);
});

router.get("/plc/devices/:deviceId", (req, res) => {
  const info = gatewayService.getDevicePlcInfo(req.params.deviceId);
  if (!info) return res.status(404).json({ error: "Device not found" });
  res.json(info);
});

router.get("/plc/mapping", (req, res) => {
  res.json(gatewayService.getMachinePlcMapping());
});

// ─────────────────────────────────────────────────────────
// VOCAB endpoints
// ─────────────────────────────────────────────────────────

// GET /api/command/vocab — ดู vocabulary ทั้งหมด
router.get("/vocab", (req, res) => {
  res.json(vocabService.getAll());
});

// POST /api/command/vocab/device — เพิ่ม device alias
router.post("/vocab/device", (req, res) => {
  const { alias, deviceId } = req.body;
  if (!alias || !deviceId) return res.status(400).json({ error: "ต้องระบุ alias และ deviceId" });
  const result = vocabService.addDeviceAlias(alias, deviceId);
  res.json({ success: true, deviceAliases: result });
});

// POST /api/command/vocab/action — เพิ่ม action alias
router.post("/vocab/action", (req, res) => {
  const { alias, action } = req.body;
  if (!alias || !action) return res.status(400).json({ error: "ต้องระบุ alias และ action" });
  const result = vocabService.addActionAlias(alias, action);
  res.json({ success: true, actionAliases: result });
});

// POST /api/command/vocab/command — เพิ่ม custom command shortcut
router.post("/vocab/command", (req, res) => {
  const { phrase, device, action, params, note } = req.body;
  if (!phrase || !device || !action) {
    return res.status(400).json({ error: "ต้องระบุ phrase, device, action" });
  }
  const result = vocabService.addCustomCommand({ phrase, device, action, params, note });
  res.json({ success: true, command: result });
});

// DELETE /api/command/vocab/command/:id — ลบ custom command
router.delete("/vocab/command/:id", (req, res) => {
  vocabService.deleteCustomCommand(req.params.id);
  res.json({ success: true });
});

// DELETE /api/command/vocab/alias — ลบ alias
router.delete("/vocab/alias", (req, res) => {
  const { type, key } = req.body;
  vocabService.deleteAlias(type, key);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────
// POST /api/command/scenario — Trigger emergency scenario
// ─────────────────────────────────────────────────────────
router.post("/scenario", (req, res) => {
  try {
    const result = machineState.triggerEmergencyScenario();
    
    if (result.success) {
      // บันทึก history ด้วยเพื่อให้เห็นใน log ว่าเกิดการจำลองเหตุการณ์
      historyService.add({
        userMessage: "🚨 [SYSTEM TRIGGER] จำลองเหตุฉุกเฉิน",
        aiMessage: result.message,
        device: result.device,
        action: "scenario_overheat",
        params: { temp: 100 },
        model: "system",
        source: "system",
        executed: true,
        success: true
      });
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Scenario error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── FACTORY I/O — Generic Device Modbus TCP Endpoints ────────────────
// ─────────────────────────────────────────────────────────

// GET /api/command/:deviceId/status — อ่านสถานะจาก Modbus จริง
router.get("/:deviceId/status", async (req, res) => {
  const { deviceId } = req.params;
  try {
    const connected = factoryIoService.isConnected();
    let coilState = null;
    let sensorInput0 = null;
    let sensorInput1 = null;

    if (connected) {
      const status = await factoryIoService.getDeviceStatus(deviceId);
      coilState    = status.coilState;
      sensorInput0 = status.sensorInput0;
      sensorInput1 = status.sensorInput1;
    }

    const machine = machineState.get(deviceId);
    const coilMap = factoryIoService.getDeviceMap();

    res.json({
      deviceId:     deviceId,
      modbusConnected: connected,
      modbusHost:   process.env.FACTORY_IO_IP || '127.0.0.1',
      modbusPort:   502,
      slaveId:      1,
      coilAddress:  coilMap[deviceId],
      coilState:    coilState,
      sensorInput0: sensorInput0,
      sensorInput1: sensorInput1,
      machineStatus: machine?.status || 'unknown',
      machineName:  machine?.name || deviceId,
      timestamp:    new Date().toISOString()
    });
  } catch (err) {
    console.error(`[${deviceId}] GET status error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/command/:deviceId/start
router.post("/:deviceId/start", async (req, res) => {
  const { deviceId } = req.params;
  try {
    const modbusOk = await factoryIoService.writeDeviceState(deviceId, true);
    const machineResult = machineState.execute(deviceId, 'start', {});
    const coilAddress = factoryIoService.getDeviceMap()[deviceId];
    
    historyService.add({
      userMessage: `[Factory IO] Start ${deviceId}`,
      aiMessage: `เปิด ${deviceId} ผ่าน Modbus TCP`,
      device: deviceId, action: 'start', params: {},
      model: 'modbus', source: 'direct', executed: true, success: modbusOk
    });

    res.json({
      success: modbusOk,
      modbusWritten: modbusOk,
      coilAddress: coilAddress,
      coilState: true,
      machineResult,
      message: modbusOk ? `✅ เปิด ${deviceId} แล้ว (Coil ${coilAddress} = ON)` : '⚠️ Modbus ไม่ได้เชื่อมต่อ',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/command/:deviceId/stop
router.post("/:deviceId/stop", async (req, res) => {
  const { deviceId } = req.params;
  try {
    const modbusOk = await factoryIoService.writeDeviceState(deviceId, false);
    const machineResult = machineState.execute(deviceId, 'stop', {});
    const coilAddress = factoryIoService.getDeviceMap()[deviceId];

    historyService.add({
      userMessage: `[Factory IO] Stop ${deviceId}`,
      aiMessage: `ปิด ${deviceId} ผ่าน Modbus TCP`,
      device: deviceId, action: 'stop', params: {},
      model: 'modbus', source: 'direct', executed: true, success: modbusOk
    });

    res.json({
      success: modbusOk,
      modbusWritten: modbusOk,
      coilAddress: coilAddress,
      coilState: false,
      machineResult,
      message: modbusOk ? `✅ ปิด ${deviceId} แล้ว (Coil ${coilAddress} = OFF)` : '⚠️ Modbus ไม่ได้เชื่อมต่อ',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/command/modbus/reconnect
router.post("/modbus/reconnect", (req, res) => {
  factoryIoService.connect();
  res.json({ success: true, message: 'กำลังเชื่อมต่อ Factory I/O ใหม่...' });
});

module.exports = router;
