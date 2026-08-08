// ============================================================
// AI Robot Operator - Machine State Service
// เก็บสถานะเครื่องจักรแบบ In-Memory (จำลองสถานะ PLC)
// ============================================================

let machineState = {
  conveyor1: {
    id: "conveyor1", name: "Conveyor 1", nameEn: "Conveyor 1",
    status: "stopped", speed: 0, temp: 38,
    metricName: "ความเร็ว", unit: "%", icon: "🏭",
    plcInfo: { station: "PLC-01", brand: "Mitsubishi", model: "FX5U-32MT/ESS", ip: "192.168.1.20", coil: "00001", bit: "M0" }
  },
  conveyor2: {
    id: "conveyor2", name: "Conveyor 2", nameEn: "Conveyor 2",
    status: "stopped", speed: 0, temp: 35,
    metricName: "ความเร็ว", unit: "%", icon: "🏭",
    plcInfo: { station: "PLC-01", brand: "Mitsubishi", model: "FX5U-32MT/ESS", ip: "192.168.1.20", coil: "00002", bit: "M1" }
  },
  motor1: {
    id: "motor1", name: "มอเตอร์หลัก", nameEn: "Main Motor",
    status: "stopped", speed: 0, temp: 42,
    metricName: "ความเร็วรอบ", unit: "%", icon: "⚙️",
    plcInfo: { station: "PLC-01", brand: "Mitsubishi", model: "FX5U-32MT/ESS", ip: "192.168.1.20", coil: "00003", bit: "M2" }
  },
  pump1: {
    id: "pump1", name: "ปั๊มน้ำหล่อเย็น", nameEn: "Cooling Pump",
    status: "stopped", speed: 0, temp: 30,
    metricName: "อัตราการไหล", unit: "%", icon: "💧",
    plcInfo: { station: "PLC-01", brand: "Mitsubishi", model: "FX5U-32MT/ESS", ip: "192.168.1.20", coil: "00004", bit: "M3" }
  },
  fan1: {
    id: "fan1", name: "พัดลมระบายความร้อน", nameEn: "Cooling Fan",
    status: "stopped", speed: 0, temp: 28,
    metricName: "ความเร็วลม", unit: "%", icon: "🌀",
    plcInfo: { station: "PLC-01", brand: "Mitsubishi", model: "FX5U-32MT/ESS", ip: "192.168.1.20", coil: "00005", bit: "M4" }
  },
  robot1: {
    id: "robot1", name: "หุ่นยนต์แขนกล", nameEn: "Robot Arm",
    status: "stopped", speed: 0, temp: 33,
    metricName: "ความเร็วการทำงาน", unit: "%", icon: "🦾",
    plcInfo: { station: "PLC-02", brand: "Siemens", model: "S7-1200 CPU 1214C", ip: "192.168.1.21", coil: "00006", bit: "%M0.5" }
  },
  agv1: {
    id: "agv1", name: "รถ AGV ลำเลียง", nameEn: "AGV Transport",
    status: "stopped", speed: 0, temp: 32,
    metricName: "ความเร็วการเดิน", unit: "%", icon: "🚜",
    plcInfo: { station: "PLC-02", brand: "Siemens", model: "S7-1200 CPU 1214C", ip: "192.168.1.21", coil: "00007", bit: "%M0.7" }
  },
  heater1: {
    id: "heater1", name: "ฮีตเตอร์เตาอบ", nameEn: "Oven Heater",
    status: "stopped", speed: 0, temp: 45,
    metricName: "ระดับความร้อน", unit: "%", icon: "♨️",
    plcInfo: { station: "PLC-03", brand: "Schneider", model: "Modicon M221", ip: "192.168.1.22", coil: "00008", bit: "%M8" }
  },
  compressor1: {
    id: "compressor1", name: "เครื่องปั๊มลม", nameEn: "Air Compressor",
    status: "stopped", speed: 0, temp: 40,
    metricName: "แรงดันลม", unit: "PSI", icon: "💨",
    plcInfo: { station: "PLC-03", brand: "Schneider", model: "Modicon M221", ip: "192.168.1.22", coil: "00009", bit: "%M9" }
  },
  crane1: {
    id: "crane1", name: "เครนยกสินค้า", nameEn: "Overhead Crane",
    status: "stopped", speed: 0, temp: 34,
    metricName: "ความเร็วรอก", unit: "%", icon: "🏗️",
    plcInfo: { station: "PLC-03", brand: "Schneider", model: "Modicon M221", ip: "192.168.1.22", coil: "00010", bit: "%M10" }
  },
  light1: {
    id: "light1", name: "ไฟสัญญาณเตือน", nameEn: "Tower Light",
    status: "stopped", speed: 0, temp: 27,
    metricName: "ระดับความสว่าง", unit: "%", icon: "🚨",
    plcInfo: { station: "PLC-03", brand: "Schneider", model: "Modicon M221", ip: "192.168.1.22", coil: "00011", bit: "%M11" }
  },
  chiller1: {
    id: "chiller1", name: "เครื่องทำความเย็น", nameEn: "Chiller Unit",
    status: "stopped", speed: 0, temp: 18,
    metricName: "ระดับความเย็น", unit: "%", icon: "❄️",
    plcInfo: { station: "PLC-03", brand: "Schneider", model: "Modicon M221", ip: "192.168.1.22", coil: "00012", bit: "%M12" }
  }
};

// อุณหภูมิจะขึ้นเมื่อ running แล้วค่อย ๆ ลดตอน stopped
setInterval(() => {
  Object.values(machineState).forEach(machine => {
    if (machine.status === "running") {
      machine.temp = Math.min(machine.temp + Math.random() * 0.5, 95);
    } else {
      machine.temp = Math.max(machine.temp - Math.random() * 0.3, 25);
    }
    machine.temp = parseFloat(machine.temp.toFixed(1));

    // Warning เมื่ออุณหภูมิสูง
    if (machine.status === "running" && machine.temp > 80) {
      machine.status = "warning";
    } else if (machine.status === "warning" && machine.temp < 75) {
      machine.status = "running";
    }
  });
}, 3000);

module.exports = {
  getAll: () => machineState,
  get: (id) => machineState[id],

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
        return { success: true, message: `เปิด ${machine.name} แล้ว (${machine.metricName}: ${machine.speed}${machine.unit})` };

      case "stop":
      case "off":
        machine.status = "stopped";
        machine.speed = 0;
        return { success: true, message: `หยุด ${machine.name} แล้ว` };

      case "set_speed":
        if (machine.status !== "running") {
          machine.status = "running";
        }
        machine.speed = Math.max(0, Math.min(100, params.speed || 50));
        return { success: true, message: `ตั้ง${machine.metricName} ${machine.name} เป็น ${machine.speed}${machine.unit}` };

      case "emergency_stop":
        machine.status = "error";
        machine.speed = 0;
        return { success: true, message: `⚠️ Emergency Stop: ${machine.name}` };

      case "reset":
        machine.status = "stopped";
        machine.speed = 0;
        machine.temp = 30;
        return { success: true, message: `Reset ${machine.name} เรียบร้อย` };

      default:
        return { success: false, error: `ไม่รู้จัก action: ${action}` };
    }
  }
};
