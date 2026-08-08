// ============================================================
// MQTT Service - สำหรับส่งคำสั่งไปยัง Raspberry Pi / PLC
// ============================================================

const mqtt = require("mqtt");

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const MQTT_TOPIC_COMMAND = "factory/command";
const MQTT_TOPIC_STATUS = "factory/status";

let client = null;
let isConnected = false;
let messageLog = [];

function connect() {
  try {
    console.log(`🔌 Connecting to MQTT broker: ${MQTT_BROKER}`);
    
    client = mqtt.connect(MQTT_BROKER, {
      clientId: `ai-operator-${Date.now()}`,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
    });

    client.on("connect", () => {
      isConnected = true;
      console.log("✅ MQTT connected!");
      client.subscribe(MQTT_TOPIC_STATUS);
    });

    client.on("error", (err) => {
      isConnected = false;
      console.log(`⚠️ MQTT error (broker ไม่พร้อม - Simulate mode): ${err.message}`);
    });

    client.on("close", () => {
      isConnected = false;
    });

    client.on("message", (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        console.log(`📡 MQTT received [${topic}]:`, data);
      } catch (e) {}
    });

  } catch (err) {
    console.log(`⚠️ MQTT init failed - ทำงานใน Simulate mode`);
  }
}

function publish(device, action, params = {}) {
  const payload = {
    device,
    action,
    params,
    timestamp: new Date().toISOString(),
    source: "ai-operator"
  };

  const logEntry = {
    ...payload,
    mqttStatus: isConnected ? "sent" : "simulated"
  };
  messageLog.unshift(logEntry);
  if (messageLog.length > 100) messageLog.pop();

  if (isConnected && client) {
    client.publish(MQTT_TOPIC_COMMAND, JSON.stringify(payload));
    console.log(`📤 MQTT published to ${MQTT_TOPIC_COMMAND}:`, payload);
    return { sent: true, mode: "mqtt" };
  } else {
    // Simulate mode - แสดงว่าจะส่งอะไรไป Pi
    console.log(`🎮 [SIMULATE] MQTT → ${MQTT_TOPIC_COMMAND}:`, payload);
    return { sent: false, mode: "simulate", payload };
  }
}

function getStatus() {
  return {
    connected: isConnected,
    broker: MQTT_BROKER,
    mode: isConnected ? "live" : "simulate"
  };
}

function getLog() {
  return messageLog;
}

// เริ่ม connect เมื่อ load module
connect();

module.exports = { publish, getStatus, getLog };
