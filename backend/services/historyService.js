// ============================================================
// Command History Service - เก็บประวัติคำสั่ง
// ============================================================

const { v4: uuidv4 } = require("uuid");

let history = [];
const MAX_HISTORY = 200;

function add(entry) {
  const record = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry
  };
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.pop();
  return record;
}

function getAll(limit = 50) {
  return history.slice(0, limit);
}

function clear() {
  history = [];
}

function updateExecuted(id, machineResult) {
  const record = history.find(h => h.id === id);
  if (record) {
    record.executed = true;
    record.machineResult = machineResult;
    record.success = machineResult?.success ?? false;
    record.executedAt = new Date().toISOString();
  }
}

function getById(id) {
  return history.find(h => h.id === id);
}

module.exports = { add, getAll, clear, updateExecuted, getById };

