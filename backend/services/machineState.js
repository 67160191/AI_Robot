// ============================================================
// AI Robot Operator - Machine State Service
// เก็บสถานะเครื่องจักรแบบ In-Memory (จำลองสถานะ PLC)
// ============================================================

let machineState = {
  conveyor1: {
    id: "conveyor1",
    name: "Conveyor 1",
    nameEn: "Conveyor 1",
    status: "stopped",   // running | stopped | warning | error
    speed: 0,            // 0-100 %
    temp: 38,
    unit: "%",
    icon: "🏭"
  },
  conveyor2: {
    id: "conveyor2",
    name: "Conveyor 2",
    nameEn: "Conveyor 2",
    status: "stopped",
    speed: 0,
    temp: 35,
    unit: "%",
    icon: "🏭"
  },
  motor1: {
    id: "motor1",
    name: "มอเตอร์หลัก",
    nameEn: "Main Motor",
    status: "stopped",
    speed: 0,
    temp: 42,
    unit: "%",
    icon: "⚙️"
  },
  pump1: {
    id: "pump1",
    name: "ปั๊มน้ำหล่อเย็น",
    nameEn: "Cooling Pump",
    status: "stopped",
    speed: 0,
    temp: 30,
    unit: "%",
    icon: "💧"
  },
  fan1: {
    id: "fan1",
    name: "พัดลมระบายความร้อน",
    nameEn: "Cooling Fan",
    status: "stopped",
    speed: 0,
    temp: 28,
    unit: "%",
    icon: "🌀"
  },
  robot1: {
    id: "robot1",
    name: "หุ่นยนต์แขนกล",
    nameEn: "Robot Arm",
    status: "stopped",
    speed: 0,
    temp: 33,
    unit: "%",
    icon: "🦾"
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
    const machine = machineState[deviceId];
    if (!machine) {
      return { success: false, error: `ไม่พบอุปกรณ์: ${deviceId}` };
    }

    switch (action.toLowerCase()) {
      case "start":
      case "on":
        machine.status = "running";
        machine.speed = params.speed || 60;
        return { success: true, message: `เปิด ${machine.name} แล้ว ที่ความเร็ว ${machine.speed}%` };

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
        return { success: true, message: `ตั้งความเร็ว ${machine.name} เป็น ${machine.speed}%` };

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
