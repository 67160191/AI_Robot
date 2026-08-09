// ============================================================
// AI Robot Operator - PLC Simulator Service
// จำลองสถานะ PLC (online/offline, heartbeat, errors, telemetry)
// ============================================================

const fs = require('fs');
const path = require('path');

// โหลด PLC config
const plcsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/plcs.json'), 'utf8'));
const machinesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/machines.json'), 'utf8'));

// PLC States (จำลองสถานะแต่ละตัว)
const plcStates = {};
plcsConfig.plcs.forEach(plc => {
  plcStates[plc.id] = {
    id: plc.id,
    station: plc.station,
    brand: plc.brand,
    model: plc.model,
    ip: plc.ip,
    status: 'online', // online | offline | error
    uptime: plc.uptime,
    errorRate: plc.errorRate,
    lastHeartbeat: Date.now(),
    heartbeatMissed: 0,
    errors: [],
    telemetry: {
      cpuLoad: Math.random() * 30 + 10,
      memoryUsage: Math.random() * 40 + 30,
      ioStatus: {},
      networkLatency: Math.random() * 20 + 5
    },
    devices: plc.devices.map(devId => {
      const devConfig = machinesConfig.machines.find(m => m.id === devId);
      return {
        id: devId,
        name: devConfig ? devConfig.name : devId,
        status: 'stopped',
        temp: devConfig ? devConfig.temp : 25,
        connected: true
      };
    })
  };
});

// สร้าง machine lookup
const machineToPLC = {};
plcsConfig.plcs.forEach(plc => {
  plc.devices.forEach(devId => {
    machineToPLC[devId] = plc.id;
  });
});

// ─── PLC Heartbeat Simulation ─────────────────────────────
// จำลอง PLC heartbeat (มี chance offline สลับ)
setInterval(() => {
  Object.values(plcStates).forEach(plc => {
    // Random offline/online toggle (1% chance per tick)
    if (Math.random() < 0.01) {
      plc.status = plc.status === 'online' ? 'offline' : 'online';
      plc.lastHeartbeat = Date.now();
      plc.heartbeatMissed = 0;

      // Log event
      console.log(`[PLC-SIM] ${plc.station} (${plc.ip}) → ${plc.status.toUpperCase()}`);
    }

    // อัพเดท heartbeat missed count
    if (plc.status === 'offline') {
      plc.heartbeatMissed++;
      if (plc.heartbeatMissed > 10) {
        plc.status = 'error'; // error ถ้า miss heartbeats เกิน 10 ครั้ง
      }
    } else {
      plc.lastHeartbeat = Date.now();
      plc.heartbeatMissed = 0;
    }

    // อัพเดท telemetry
    plc.telemetry.cpuLoad = Math.max(5, Math.min(95, plc.telemetry.cpuLoad + (Math.random() - 0.5) * 5));
    plc.telemetry.memoryUsage = Math.max(20, Math.min(90, plc.telemetry.memoryUsage + (Math.random() - 0.5) * 3));
    plc.telemetry.networkLatency = Math.max(1, Math.min(50, plc.telemetry.networkLatency + (Math.random() - 0.5) * 10));

    // Random errors (น้อยมาก)
    if (plc.status === 'online' && Math.random() < 0.002) {
      const errorTypes = ['I/O timeout', 'CPU overload', 'Memory warning', 'Network jitter'];
      plc.errors.push({
        time: new Date().toISOString(),
        type: errorTypes[Math.floor(Math.random() * errorTypes.length)],
        severity: Math.random() < 0.3 ? 'critical' : 'warning'
      });
      // เก็บแค่ 10 errors ล่าสุด
      if (plc.errors.length > 10) plc.errors.shift();
    }

    // Clean old errors (> 5 min)
    plc.errors = plc.errors.filter(e => (Date.now() - new Date(e.time).getTime()) < 300000);
  });
}, 3000);

// ─── Machine Status Tracking ──────────────────────────────
// อัพเดท machine status จาก PLC simulation
const getPLCForDevice = (deviceId) => {
  const plcId = machineToPLC[deviceId];
  return plcId ? plcStates[plcId] : null;
};

module.exports = {
  // ได้สถานะทั้งหมดของ PLCs
  getAllPLCs: () => plcStates,

  // ได้สถานะ PLC เฉพาะตัว
  getPLC: (id) => plcStates[id],

  // ได้ device-to-PLC mapping
  getPLCForDevice,

  // ได้ machines สำหรับ PLC แต่ละตัว
  getDevicesByPLC: (plcId) => {
    return plcStates[plcId]?.devices || [];
  },

  // อัพเดท machine status จาก command execution
  updateDeviceStatus: (deviceId, status, params = {}) => {
    const plcId = machineToPLC[deviceId];
    if (!plcId) return { success: false, error: 'Device not found in PLC mapping' };

    const plc = plcStates[plcId];
    const device = plc.devices.find(d => d.id === deviceId);

    if (device) {
      device.status = status;
      if (params.temp !== undefined) device.temp = params.temp;
    }

    return { success: true, device, plc };
  },

  // ได้ telemetry ของ PLC แต่ละตัว
  getTelemetry: (plcId) => {
    const plc = plcStates[plcId];
    if (!plc) return null;

    return {
      ...plc.telemetry,
      status: plc.status,
      uptime: plc.uptime,
      errors: plc.errors,
      deviceCount: plc.devices.length,
      onlineDevices: plc.devices.filter(d => d.status === 'running').length
    };
  },

  // ได้ summary ทั้งหมด
  getSummary: () => {
    const plcs = Object.values(plcStates);
    return {
      totalPLCs: plcs.length,
      onlinePLCs: plcs.filter(p => p.status === 'online').length,
      offlinePLCs: plcs.filter(p => p.status === 'offline').length,
      errorPLCs: plcs.filter(p => p.status === 'error').length,
      totalDevices: plcs.reduce((sum, p) => sum + p.devices.length, 0),
      runningDevices: plcs.reduce((sum, p) => sum + p.devices.filter(d => d.status === 'running').length, 0),
      criticalErrors: plcs.reduce((sum, p) => sum + p.errors.filter(e => e.severity === 'critical').length, 0),
      plcs: plcs.map(p => ({
        id: p.id,
        station: p.station,
        brand: p.brand,
        model: p.model,
        ip: p.ip,
        status: p.status,
        uptime: parseFloat(p.uptime.toFixed(1)),
        deviceCount: p.devices.length,
        onlineDevices: p.devices.filter(d => d.status === 'running').length,
        errorCount: p.errors.length
      }))
    };
  }
};