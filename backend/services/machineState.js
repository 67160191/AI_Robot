// ============================================================
// AI Robot Operator - Machine State Service
// เก็บสถานะเครื่องจักรแบบ In-Memory + รองรับ Multi-PLC
// ============================================================

const plcSimulator = require('./plcSimulator');
const fs = require('fs');
const path = require('path');

// โหลด machine config
const machinesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/machines.json'), 'utf8'));

// In-Machine State (จำลองสถานะ PLC)
let machineState = {};
machinesConfig.machines.forEach(m => {
  machineState[m.id] = {
    id: m.id,
    name: m.name,
    nameEn: m.nameEn,
    status: m.status,
    speed: m.speed,
    temp: m.temp,
    metricName: m.metricName,
    unit: m.unit,
    icon: m.icon,
    plcId: m.plcId,
    plcInfo: null, // จะตั้งด้านล่าง
    simulation: m.simulation,
    additionalParams: m.additionalParams || {},
    // เพิ่ม parameters เพิ่มเติม
    current: (m.additionalParams?.current?.value || 0),
    voltage: (m.additionalParams?.voltage?.value || 0),
    position: (m.additionalParams?.position?.value || 'home'),
    gripper: (m.additionalParams?.gripper?.value || 0),
    battery: (m.additionalParams?.battery?.value || 100),
    direction: (m.additionalParams?.direction?.value || 'idle'),
    targetTemp: (m.additionalParams?.targetTemp?.value || 0),
    pressure: (m.additionalParams?.pressure?.value || 0),
    height: (m.additionalParams?.height?.value || 0),
    load: (m.additionalParams?.load?.value || 0),
    color: (m.additionalParams?.color?.value || 'off'),
    coolingLevel: (m.additionalParams?.coolingLevel?.value || 0)
  };
});

// ตั้ง PLC info สำหรับแต่ละ machine
const plcsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/plcs.json'), 'utf8'));
plcsConfig.plcs.forEach(plc => {
  plc.devices.forEach(devId => {
    if (machineState[devId]) {
      machineState[devId].plcInfo = {
        station: plc.station,
        brand: plc.brand,
        model: plc.model,
        ip: plc.ip,
        plcId: plc.id,
        ...plc.coilMappings?.[devId] || {}
      };
    }
  });
});

// ─── Temperature Simulation ───────────────────────────────
// อุณหภูมิจะขึ้นเมื่อ running แล้วค่อย ๆ ลดตอน stopped
setInterval(() => {
  Object.values(machineState).forEach(machine => {
    const sim = machine.simulation || {};
    const riseRate = sim.tempRiseRate || 0.5;
    const coolRate = sim.tempCoolRate || 0.3;
    const warningTemp = sim.warningTemp || 80;

    if (machine.status === "running") {
      machine.temp = Math.min(machine.temp + Math.random() * riseRate, warningTemp - 5);
    } else if (machine.status === "stopped" || machine.status === "error") {
      machine.temp = Math.max(machine.temp - Math.random() * coolRate, 25);
    }

    machine.temp = parseFloat(machine.temp.toFixed(1));

    // Warning เมื่ออุณหภูมิสูง
    if (machine.status === "running" && machine.temp > warningTemp) {
      machine.status = "warning";
    } else if (machine.status === "warning" && machine.temp < warningTemp - 5) {
      machine.status = "running";
    }

    // อัพเดท additional params เมื่อ running
    if (machine.status === "running") {
      // Current/Voltage สำหรับ motor1
      if (machine.additionalParams?.current) {
        machine.current = Math.min(25, machine.current + Math.random() * 2);
        machine.voltage = 380 + Math.random() * 5;
      }
      // Battery สำหรับ agv1
      if (machine.additionalParams?.battery) {
        machine.battery = Math.max(0, machine.battery - Math.random() * 0.1);
      }
      // TargetTemp สำหรับ heater1
      if (machine.additionalParams?.targetTemp) {
        machine.targetTemp = machine.speed * 1.8;
      }
      // Pressure สำหรับ compressor1
      if (machine.additionalParams?.pressure) {
        machine.pressure = machine.speed * 1.2;
      }
    }
  });
}, 3000);

// ─── Sync Machine State to PLC Simulator ──────────────────
// ซิงค์สถานะเครื่องจักรกลับไปยัง PLC simulator
const syncToPLC = () => {
  Object.entries(machineState).forEach(([deviceId, machine]) => {
    plcSimulator.updateDeviceStatus(deviceId, machine.status, { temp: machine.temp });
  });
};
setInterval(syncToPLC, 5000);

module.exports = {
  // ได้สถานะทั้งหมดของเครื่องจักร
  getAll: () => machineState,

  // ได้สถานะเครื่องจักรเฉพาะตัว
  get: (id) => machineState[id],

  // executed command → อัพเดท machine state + PLC simulator
  execute: (deviceId, action, params = {}) => {
    // กรณีสั่งทุกเครื่อง (Broadcast)
    if (deviceId === "all") {
      let executedCount = 0;
      for (const key of Object.keys(machineState)) {
        module.exports.execute(key, action, params);
        executedCount++;
      }
      const actionName = action === "start" ? "เปิด" : action === "stop" ? "ปิด" : action === "emergency_stop" ? "หยุดฉุกเฉิน" : "สั่ง";
      return { success: true, message: `ดำเนินการ${actionName}เครื่องจักรทั้งหมด (${executedCount} เครื่อง) เรียบร้อยแล้ว` };
    }

    const machine = machineState[deviceId];
    if (!machine) {
      return { success: false, error: `ไม่พบอุปกรณ์: ${deviceId}` };
    }

    switch (action.toLowerCase()) {
      case "start":
      case "on":
        machine.status = "running";
        machine.speed = params.speed || 60;
        plcSimulator.updateDeviceStatus(deviceId, "running", { temp: machine.temp });
        return { 
          success: true, 
          message: `เปิด ${machine.name} แล้ว (${machine.metricName}: ${machine.speed}${machine.unit})`,
          device: deviceId,
          action,
          params: { speed: machine.speed }
        };

      case "stop":
      case "off":
        machine.status = "stopped";
        machine.speed = 0;
        plcSimulator.updateDeviceStatus(deviceId, "stopped", { temp: machine.temp });
        return { 
          success: true, 
          message: `หยุด ${machine.name} แล้ว`,
          device: deviceId,
          action,
          params: { speed: 0 }
        };

      case "set_speed":
        if (machine.status !== "running") {
          machine.status = "running";
          plcSimulator.updateDeviceStatus(deviceId, "running", { temp: machine.temp });
        }
        machine.speed = Math.max(0, Math.min(100, params.speed || 50));
        return { 
          success: true, 
          message: `ตั้ง${machine.metricName} ${machine.name} เป็น ${machine.speed}${machine.unit}`,
          device: deviceId,
          action,
          params: { speed: machine.speed }
        };

      case "set_current":
        if (machine.additionalParams?.current) {
          machine.current = Math.max(0, Math.min(30, params.current || 10));
        }
        return { 
          success: true, 
          message: `ตั้งกระแส ${machine.name} เป็น ${machine.current}A`,
          device: deviceId,
          action: "set_current",
          params: { current: machine.current }
        };

      case "set_target_temp":
        if (machine.additionalParams?.targetTemp) {
          machine.targetTemp = Math.max(0, Math.min(200, params.targetTemp || 100));
        }
        return { 
          success: true, 
          message: `ตั้งอุณหภูมิเป้าหมาย ${machine.name} เป็น ${machine.targetTemp}°C`,
          device: deviceId,
          action: "set_target_temp",
          params: { targetTemp: machine.targetTemp }
        };

      case "set_pressure":
        if (machine.additionalParams?.pressure) {
          machine.pressure = Math.max(0, Math.min(150, params.pressure || 80));
        }
        return { 
          success: true, 
          message: `ตั้งแรงดันลม ${machine.name} เป็น ${machine.pressure}PSI`,
          device: deviceId,
          action: "set_pressure",
          params: { pressure: machine.pressure }
        };

      case "emergency_stop":
        machine.status = "error";
        machine.speed = 0;
        plcSimulator.updateDeviceStatus(deviceId, "error", { temp: machine.temp });
        return { success: true, message: `⚠️ Emergency Stop: ${machine.name}` };

      case "reset":
        machine.status = "stopped";
        machine.speed = 0;
        machine.temp = machine.simulation?.normalTemp || 30;
        plcSimulator.updateDeviceStatus(deviceId, "stopped", { temp: machine.temp });
        return { success: true, message: `Reset ${machine.name} เรียบร้อย` };

      default:
        return { success: false, error: `ไม่รู้จัก action: ${action}` };
    }
  },

  triggerEmergencyScenario: () => {
    // หาเครื่องที่ running อยู่, ถ้าไม่มีเอาเครื่องที่มี ID เป็น 'heater1' หรืออันแรกสุด
    let target = Object.values(machineState).find(m => m.status === 'running');
    if (!target) target = machineState['heater1'] || Object.values(machineState)[0];

    if (target) {
      target.temp = 100;
      target.status = 'warning';
      plcSimulator.updateDeviceStatus(target.id, 'warning', { temp: 100 });
      return { success: true, message: `🚨 จำลองเหตุฉุกเฉิน: อุณหภูมิ ${target.name} พุ่งสูงถึง 100°C!`, device: target.id };
    }
    return { success: false, error: 'ไม่พบเครื่องจักรที่เหมาะสมในการจำลองเหตุการณ์' };
  }
};