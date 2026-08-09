// ============================================================
// AI Robot Operator - Gateway Service (Python PyModbus <-> PLC Modbus TCP)
// IP: 192.168.1.20 | Port: 502 | Protocol: Modbus TCP
// ข้อมูลการเชื่อมต่อเครื่องจักรกับ PLC ทั้งหมดแบบรายละเอียด
// ============================================================

const { v4: uuidv4 } = require("uuid");

// ─── การตั้งค่า Gateway & PLC Config ───────────────────────────
const config = {
  gatewayName: "AI ROBOT OPERATOR - PyModbus Gateway",
  plcConnection: "CONNECTED",
  ipAddress: "192.168.1.20",
  protocol: "Modbus TCP",
  port: 502,
  slaveId: 1,
  plcStatus: "RUNNING",
  lastActive: new Date().toISOString()
};

// ─── รายละเอียดการเชื่อมต่อเครื่องจักรทั้ง 12 ตัว กับ PLC แบบรายละเอียด ───
const MACHINE_PLC_MAPPING = {
  conveyor1: {
    id: "conveyor1",
    name: "Conveyor 1 (สายพานลำเลียง 1)",
    category: "Production Line",
    plcStation: "PLC-01 (Main Assembly Line)",
    plcBrand: "Mitsubishi Electric",
    plcModel: "FX5U-32MT/ESS",
    plcIp: "192.168.1.20",
    modbusPort: 502,
    slaveId: 1,
    coilAddr: "00001",
    plcBit: "M0",
    regAddr: "40001",
    plcReg: "D100",
    outputTerminal: "Y0 (Relay 24VDC)",
    speedTerminal: "Analog Out (0-10VDC) - FX5-4DA (CH1)",
    feedbackInput: "X0 (Proximity Sensor PE1)",
    driverType: "Mitsubishi VFD Inverter (FR-E800)",
    startCmd: "START_CONVEYOR_1",
    stopCmd: "STOP_CONVEYOR_1",
    wiringDetails: "พอร์ต Y0 ต่อเข้ากับ Magnetic Contactor KM1 (เปิด/ปิด), Analog CH1 ต่อเข้าพอร์ต SD/10 ของ VFDFR-E800 เพื่อปรับ Hz ความเร็วสายพาน"
  },
  conveyor2: {
    id: "conveyor2",
    name: "Conveyor 2 (สายพานลำเลียง 2)",
    category: "Production Line",
    plcStation: "PLC-01 (Main Assembly Line)",
    plcBrand: "Mitsubishi Electric",
    plcModel: "FX5U-32MT/ESS",
    plcIp: "192.168.1.20",
    modbusPort: 502,
    slaveId: 1,
    coilAddr: "00002",
    plcBit: "M1",
    regAddr: "40002",
    plcReg: "D101",
    outputTerminal: "Y1 (Relay 24VDC)",
    speedTerminal: "Analog Out (0-10VDC) - FX5-4DA (CH2)",
    feedbackInput: "X1 (Proximity Sensor PE2)",
    driverType: "Mitsubishi VFD Inverter (FR-E800)",
    startCmd: "START_CONVEYOR_2",
    stopCmd: "STOP_CONVEYOR_2",
    wiringDetails: "พอร์ต Y1 ต่อเข้ากับ Magnetic Contactor KM2, Analog CH2 ต่อเข้าพอร์ต SD/10 ของ VFDFR-E800 ตัวที่ 2"
  },
  motor1: {
    id: "motor1",
    name: "Main Motor (มอเตอร์ขับเคลื่อนหลัก)",
    category: "Production Line",
    plcStation: "PLC-01 (Main Assembly Line)",
    plcBrand: "Mitsubishi Electric",
    plcModel: "FX5U-32MT/ESS",
    plcIp: "192.168.1.20",
    modbusPort: 502,
    slaveId: 1,
    coilAddr: "00003",
    plcBit: "M2",
    regAddr: "40003",
    plcReg: "D102",
    outputTerminal: "Y2 (Relay 24VDC)",
    speedTerminal: "Analog Out (4-20mA) - FX5-4DA (CH3)",
    feedbackInput: "X2 (Encoder Pulse Input High-Speed C235)",
    driverType: "Servo Driver (MR-J4-A)",
    startCmd: "START_MOTOR_1",
    stopCmd: "STOP_MOTOR_1",
    wiringDetails: "พอร์ต Y2 จ่ายสัญญาณ Servo ON (SON), สัญญาณ Analog Pulse ต่อเข้า Servo Drive เพื่อคุมรอบหมุน RPM และจับพัลส์ด้วย Encoder บน X2"
  },
  pump1: {
    id: "pump1",
    name: "Cooling Pump (ปั๊มน้ำหล่อเย็น)",
    category: "Utilities & Cooling",
    plcStation: "PLC-01 (Main Assembly Line)",
    plcBrand: "Mitsubishi Electric",
    plcModel: "FX5U-32MT/ESS",
    plcIp: "192.168.1.20",
    modbusPort: 502,
    slaveId: 1,
    coilAddr: "00004",
    plcBit: "M3",
    regAddr: "40004",
    plcReg: "D103",
    outputTerminal: "Y3 (Relay 24VDC)",
    speedTerminal: "Modbus RTU RS485 (FX5-485-BD)",
    feedbackInput: "X3 (Flow Switch FS1)",
    driverType: "Water Pump Motor Starter Delta",
    startCmd: "START_PUMP_1",
    stopCmd: "STOP_PUMP_1",
    wiringDetails: "พอร์ต Y3 ต่อขับ Star-Delta Starter คอนแทกเตอร์ ปั๊มน้ำหล่อเย็น สื่อสารปรับอัตราไหลผ่าน RS485"
  },
  fan1: {
    id: "fan1",
    name: "Cooling Fan (พัดลมระบายความร้อน)",
    category: "Utilities & Cooling",
    plcStation: "PLC-01 (Main Assembly Line)",
    plcBrand: "Mitsubishi Electric",
    plcModel: "FX5U-32MT/ESS",
    plcIp: "192.168.1.20",
    modbusPort: 502,
    slaveId: 1,
    coilAddr: "00005",
    plcBit: "M4",
    regAddr: "40005",
    plcReg: "D104",
    outputTerminal: "Y4 (Relay 24VDC)",
    speedTerminal: "PWM Pulse Output Y4",
    feedbackInput: "X4 (Thermal Overload Relay OL1)",
    driverType: "Exhaust Blower Fan Controller",
    startCmd: "START_FAN_1",
    stopCmd: "STOP_FAN_1",
    wiringDetails: "พอร์ต Y4 ต่อผ่าน SSR (Solid State Relay) ควบคุมพัดลมระบายความร้อนตู้คอนโทรลและโซนระบายความร้อน"
  },
  robot1: {
    id: "robot1",
    name: "Robot Arm (หุ่นยนต์แขนกลประกอบชิ้นส่วน)",
    category: "Robotics & Automation",
    plcStation: "PLC-02 (Robot & AGV Cell)",
    plcBrand: "Siemens",
    plcModel: "S7-1200 CPU 1214C",
    plcIp: "192.168.1.21",
    modbusPort: 502,
    slaveId: 2,
    coilAddr: "00006",
    plcBit: "M5 (%M0.5)",
    regAddr: "40006",
    plcReg: "D105 (%MW100)",
    outputTerminal: "%Q0.0 (Digital Output 24VDC)",
    speedTerminal: "PROFINET Industrial Ethernet (100Mbps)",
    feedbackInput: "%I0.0 (Robot Ready Signal / Emergency Switch)",
    driverType: "FANUC / ABB Industrial Robot Controller",
    startCmd: "START_ROBOT_1",
    stopCmd: "STOP_ROBOT_1",
    wiringDetails: "เชื่อมต่อผ่านสาย Ethernet PROFINET เข้ากับหุ่นยนต์แขนกล สั่ง Start/Stop ผ่าน %Q0.0 และปรับสปีดผ่าน PROFINET Data Packet"
  },
  agv1: {
    id: "agv1",
    name: "AGV Transport (รถ AGV ลำเลียงชิ้นส่วน)",
    category: "Robotics & Automation",
    plcStation: "PLC-02 (Robot & AGV Cell)",
    plcBrand: "Siemens",
    plcModel: "S7-1200 CPU 1214C",
    plcIp: "192.168.1.21",
    modbusPort: 502,
    slaveId: 2,
    coilAddr: "00007",
    plcBit: "M7 (%M0.7)",
    regAddr: "40007",
    plcReg: "D106 (%MW102)",
    outputTerminal: "%Q0.1 (Digital Output 24VDC)",
    speedTerminal: "Wi-Fi 2.4GHz / Industrial Wireless Client",
    feedbackInput: "%I0.1 (LiDAR Obstacle Avoidance Sensor)",
    driverType: "AGV Motor Driver (BLDC 48VDC)",
    startCmd: "START_AGV_1",
    stopCmd: "STOP_AGV_1",
    wiringDetails: "ส่งสัญญาณไร้สาย (Wireless Modbus TCP) สั่งให้รถ AGV เดินตามเทปแม่เหล็กบนพื้นโรงงาน พร้อมรับค่าสิ่งกีดขวางจาก LiDAR"
  },
  heater1: {
    id: "heater1",
    name: "Oven Heater (ฮีตเตอร์เตาอบอบชิ้นส่วน)",
    category: "Thermal & Processing",
    plcStation: "PLC-03 (Utility & Environmental)",
    plcBrand: "Schneider Electric / Omron",
    plcModel: "Modicon M221 / CP1H",
    plcIp: "192.168.1.22",
    modbusPort: 502,
    slaveId: 3,
    coilAddr: "00008",
    plcBit: "M8 (%M8)",
    regAddr: "40008",
    plcReg: "D107 (%MW104)",
    outputTerminal: "%Q0.2 (SSR Trigger 24VDC)",
    speedTerminal: "PID Temperature Loop (%MW200)",
    feedbackInput: "%I0.2 (Thermocouple K-Type Sensor Pt100)",
    driverType: "3-Phase Power Controller (SCR Phase Angle)",
    startCmd: "START_HEATER_1",
    stopCmd: "STOP_HEATER_1",
    wiringDetails: "พอร์ต %Q0.2 ต่อเข้ากับ SCR Power Controller ขับฮีตเตอร์เตาอบ โดยรับอุณหภูมิจาก Thermocouple K-Type มาคำนวณ PID ลูป"
  },
  compressor1: {
    id: "compressor1",
    name: "Air Compressor (เครื่องปั๊มลมแรงดันสูง)",
    category: "Utilities & Cooling",
    plcStation: "PLC-03 (Utility & Environmental)",
    plcBrand: "Schneider Electric",
    plcModel: "Modicon M221",
    plcIp: "192.168.1.22",
    modbusPort: 502,
    slaveId: 3,
    coilAddr: "00009",
    plcBit: "M9 (%M9)",
    regAddr: "40009",
    plcReg: "D108 (%MW106)",
    outputTerminal: "%Q0.3 (Relay Output 220VAC)",
    speedTerminal: "Pressure Transmitter (4-20mA)",
    feedbackInput: "%I0.3 (Pressure Switch PS1 - 8 BAR)",
    driverType: "Screw Air Compressor Inverter Drive",
    startCmd: "START_COMPRESSOR",
    stopCmd: "STOP_COMPRESSOR",
    wiringDetails: "พอร์ต %Q0.3 สั่งเปิดเครื่องปั๊มลมหลักในโรงงาน เพื่อจ่ายแรงดันลม 8-10 PSI ให้ระบบนิวแมติกส์และแขนกล"
  },
  crane1: {
    id: "crane1",
    name: "Overhead Crane (เครนยกสินค้าเหนือหัว)",
    category: "Material Handling",
    plcStation: "PLC-03 (Utility & Environmental)",
    plcBrand: "Schneider Electric",
    plcModel: "Modicon M221",
    plcIp: "192.168.1.22",
    modbusPort: 502,
    slaveId: 3,
    coilAddr: "00010",
    plcBit: "M10 (%M10)",
    regAddr: "40010",
    plcReg: "D109 (%MW108)",
    outputTerminal: "%Q0.4 (Relay Output 24VDC)",
    speedTerminal: "Dual Speed Hoist Motor Control",
    feedbackInput: "%I0.4 (Limit Switch Top/Bottom Boundary)",
    driverType: "Crane Hoist Inverter Motor Driver",
    startCmd: "START_CRANE_1",
    stopCmd: "STOP_CRANE_1",
    wiringDetails: "ต่อเข้าชุดคอนโทรลเลอร์เครนเหนือหัวสำหรับยกแม่พิมพ์ชิ้นส่วนหนักผ่านรีเลย์ %Q0.4 พร้อมสวิตช์ตัดระยะ Limit Switch บน %I0.4"
  },
  light1: {
    id: "light1",
    name: "Tower Light (ไฟสัญญาณเตือนสถานะโรงงาน)",
    category: "Safety & Warning",
    plcStation: "PLC-03 (Utility & Environmental)",
    plcBrand: "Schneider Electric",
    plcModel: "Modicon M221",
    plcIp: "192.168.1.22",
    modbusPort: 502,
    slaveId: 3,
    coilAddr: "00011",
    plcBit: "M11 (%M11)",
    regAddr: "40011",
    plcReg: "D110 (%MW110)",
    outputTerminal: "%Q0.5 (Red/Yellow/Green Relay Pins)",
    speedTerminal: "Buzzer Frequency Signal",
    feedbackInput: "%I0.5 (Reset Alarm Pushbutton)",
    driverType: "LED Signal Tower Stack Light (Patlite)",
    startCmd: "START_TOWER_LIGHT",
    stopCmd: "STOP_TOWER_LIGHT",
    wiringDetails: "ขับไฟเตือน 3 สี (เขียว=ทำงานปกติ, เหลือง=เตือน, แดง=มีข้อผิดพลาด) พร้อมไซเรนเสียงผ่านพอร์ต %Q0.5"
  },
  chiller1: {
    id: "chiller1",
    name: "Chiller Unit (เครื่องทำความเย็นหลัก)",
    category: "Utilities & Cooling",
    plcStation: "PLC-03 (Utility & Environmental)",
    plcBrand: "Schneider Electric",
    plcModel: "Modicon M221",
    plcIp: "192.168.1.22",
    modbusPort: 502,
    slaveId: 3,
    coilAddr: "00012",
    plcBit: "M12 (%M12)",
    regAddr: "40012",
    plcReg: "D111 (%MW112)",
    outputTerminal: "%Q0.6 (Relay Output 220VAC)",
    speedTerminal: "Chilled Water Setpoint (7°C)",
    feedbackInput: "%I0.6 (Water Temperature Sensor PT100)",
    driverType: "Industrial Scroll Compressor Chiller",
    startCmd: "START_CHILLER_1",
    stopCmd: "STOP_CHILLER_1",
    wiringDetails: "ต่อควบคุมคอมเพรสเซอร์เครื่องทำน้ำเย็น Chiller รักษาระดับอุณหภูมิน้ำหล่อเย็นเครื่องจักรให้อยู่ที่ 7-12°C"
  }
};

const plcStationsList = [
  {
    stationId: "PLC-01",
    name: "PLC-01 (Main Assembly Line Station)",
    brand: "Mitsubishi Electric FX5U",
    ip: "192.168.1.20",
    port: 502,
    slaveId: 1,
    machinesCount: 5,
    status: "CONNECTED",
    machines: ["conveyor1", "conveyor2", "motor1", "pump1", "fan1"]
  },
  {
    stationId: "PLC-02",
    name: "PLC-02 (Robot & AGV Cell Station)",
    brand: "Siemens S7-1200 CPU 1214C",
    ip: "192.168.1.21",
    port: 502,
    slaveId: 2,
    machinesCount: 2,
    status: "CONNECTED",
    machines: ["robot1", "agv1"]
  },
  {
    stationId: "PLC-03",
    name: "PLC-03 (Utility & Environmental Station)",
    brand: "Schneider Modicon M221",
    ip: "192.168.1.22",
    port: 502,
    slaveId: 3,
    machinesCount: 5,
    status: "CONNECTED",
    machines: ["heater1", "compressor1", "crane1", "light1", "chiller1"]
  }
];

const plcLanguages = [
  { code: "LD", name: "Ladder Diagram", desc: "หน้าตาเหมือนวงจรรีเลย์ เหมาะกับควบคุมเครื่องจักร", badge: "ยอดนิยม" },
  { code: "FBD", name: "Function Block Diagram", desc: "ต่อบล็อก Function เช่น Timer, Counter, AND/OR", badge: "Logic Block" },
  { code: "ST", name: "Structured Text", desc: "คล้ายภาษาโปรแกรม ใช้ทำ Logic ซับซ้อน", badge: "Code" },
  { code: "SFC", name: "Sequential Function Chart", desc: "เหมาะกับกระบวนการที่ทำเป็นขั้น ๆ", badge: "Flowchart" },
  { code: "IL", name: "Instruction List", desc: "คล้าย Assembly แต่เป็นภาษารุ่นเก่าและถูกถอดออกจากมาตรฐานใหม่", badge: "Legacy" }
];

const nowTimeStr = () => new Date().toLocaleTimeString('th-TH', { hour12: false });

// สถานะปัจจุบันตามฟีล Layout รูปใหม่ของผู้ใช้
let currentDashboardState = {
  header: "AI ROBOT OPERATOR",
  aiCommand: '"เปิดสายพาน"',
  gatewayCommand: "START_CONVEYOR",
  gateway: {
    status: "CONNECTED",
    protocol: "Modbus TCP",
    plcIp: "192.168.1.20",
    port: 502
  },
  plcStatus: {
    plc: "RUNNING",
    motor: "ON",
    speed: "50%",
    temp: "35°C"
  },
  communication: {
    tx: "Coil 00001 = TRUE",
    rx: "SUCCESS",
    latency: "12 ms"
  },
  eventLogs: [
    { time: "22:15:03", message: "START_CONVEYOR → PLC ✓" },
    { time: "22:15:03", message: "Motor status: ON ✓" }
  ],
  timestamp: new Date().toISOString()
};

let eventLogsHistory = [
  { time: nowTimeStr(), message: "START_CONVEYOR → PLC ✓" },
  { time: nowTimeStr(), message: "Motor status: ON ✓" }
];

/**
 * บันทึก Transaction การสั่งงาน
 */
function recordGatewayTransaction({ device, action, params = {}, userMessage = "" }) {
  const map = MACHINE_PLC_MAPPING[device] || MACHINE_PLC_MAPPING.conveyor1;

  const isStart = action === "start" || action === "on" || action === "set_speed";
  const isStop = action === "stop" || action === "off" || action === "emergency_stop";

  const gatewayCmd = isStart ? map.startCmd : (isStop ? map.stopCmd : `CMD_${action.toUpperCase()}`);
  const speedVal = params.speed !== undefined ? `${params.speed}%` : (isStart ? "50%" : "0%");
  const motorState = isStart ? "ON" : "OFF";
  const coilVal = isStart ? "TRUE" : "FALSE";
  const timeNow = nowTimeStr();

  const newLogs = [
    { time: timeNow, message: `${gatewayCmd} → ${map.plcStation.split(' ')[0]} ✓` },
    { time: timeNow, message: `${map.name} Status: ${motorState} ✓` },
    ...eventLogsHistory
  ].slice(0, 10);

  eventLogsHistory = newLogs;

  currentDashboardState = {
    id: uuidv4(),
    header: "AI ROBOT OPERATOR",
    aiCommand: userMessage ? `"${userMessage}"` : (isStart ? '"เปิดสายพาน"' : '"หยุดสายพาน"'),
    gatewayCommand: gatewayCmd,
    gateway: {
      status: "CONNECTED",
      protocol: "Modbus TCP",
      plcIp: map.plcIp,
      port: map.modbusPort
    },
    plcStatus: {
      plc: "RUNNING",
      motor: motorState,
      speed: speedVal,
      temp: `${Math.floor(30 + Math.random() * 8)}°C`
    },
    communication: {
      tx: params.speed !== undefined ? `Reg ${map.regAddr} = ${params.speed}%` : `Coil ${map.coilAddr} = ${coilVal}`,
      rx: "SUCCESS",
      latency: `${Math.floor(8 + Math.random() * 8)} ms`
    },
    // ข้อมูลเครื่องจักรที่สั่งงาน
    machineName: map.name,
    machinePlcStation: map.plcStation,
    machineTerminal: map.outputTerminal,
    machineCoil: `Coil ${map.coilAddr} (${map.plcBit})`,
    // ข้อมูล Modbus / PLC ระดับ byte
    coilAddr: map.coilAddr,
    plcBit: map.plcBit,
    regAddr: map.regAddr,
    plcReg: map.plcReg,
    slaveId: map.slaveId,
    plcBrand: map.plcBrand,
    plcModel: map.plcModel,
    eventLogs: newLogs.slice(0, 6),
    timestamp: new Date().toISOString()
  };

  config.lastActive = currentDashboardState.timestamp;
  return currentDashboardState;
}

module.exports = {
  getConfig: () => ({
    ...config,
    currentDashboardState,
    machinePlcMapping: MACHINE_PLC_MAPPING,
    plcStationsList
  }),

  getCurrentDashboardState: () => currentDashboardState,

  getMachinePlcMapping: () => MACHINE_PLC_MAPPING,

  getPlcStations: () => plcStationsList,

  getLogs: () => eventLogsHistory,

  recordGatewayTransaction,

  getPlcLanguages: () => plcLanguages
};
