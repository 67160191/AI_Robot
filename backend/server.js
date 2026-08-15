// ============================================================
// AI Robot Operator - Express Server
// ============================================================

const express = require("express");
const cors = require("cors");
const commandRouter   = require("./routes/command");
const ollamaService   = require("./services/ollamaService");
const factoryIoService = require("./services/factoryIoService");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString("th-TH")} [${req.method}] ${req.path}`);
  next();
});

// Routes
app.use("/api/command", commandRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AI Robot Operator Backend",
    timestamp: new Date().toISOString(),
    ollama: process.env.OLLAMA_URL || "http://10.80.84.24:11434",
    version: "1.0.0"
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    name: "AI Robot Operator API",
    endpoints: {
      health: "GET /health",
      command: "POST /api/command",
      commandDirect: "POST /api/command/direct",
      status: "GET /api/command/status",
      history: "GET /api/command/history",
      models: "GET /api/command/models"
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "ไม่พบ endpoint นี้" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   🤖 AI Robot Operator Backend       ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🤖 Ollama URL: ${process.env.OLLAMA_URL || "http://10.80.84.24:11434"}`);
  console.log(`📡 MQTT: ${process.env.MQTT_BROKER || "mqtt://localhost:1883"}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/command`);
  console.log(`  GET  http://localhost:${PORT}/api/command/status`);
  console.log(`  GET  http://localhost:${PORT}/api/command/history`);
  console.log(`  GET  http://localhost:${PORT}/api/command/models\n`);

  // 🔥 Warm-up: โหลด model เข้า memory ล่วงหน้า
  setTimeout(() => ollamaService.warmUp(), 2000);

  // 🔌 เชื่อมต่อ Factory I/O Modbus TCP
  factoryIoService.connect();
});


module.exports = app;
