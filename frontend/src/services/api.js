// ============================================================
// API Service
// ============================================================

const API_BASE = '/api';

async function request(method, path, body = null) {
  try {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res  = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export const api = {
  // ── AI Parse (ยังไม่ execute) ──
  sendCommand: (message, model = null) =>
    request('POST', '/command', { message, ...(model ? { model } : {}) }),

  // ── Execute หลัง user confirm ──
  executeCommand: ({ id, device, action, params = {} }) =>
    request('POST', '/command/execute', { id, device, action, params }),

  // ── Quick direct command (ไม่ผ่าน AI) ──
  directCommand: (device, action, params = {}) =>
    request('POST', '/command/direct', { device, action, params }),

  // ── Status / History / Models ──
  getStatus:  () => request('GET', '/command/status'),
  getHistory: (limit = 30) => request('GET', `/command/history?limit=${limit}`),
  getModels:  () => request('GET', '/command/models'),

  // ── Gateway & PLC Monitor ──
  getGatewayStatus:    () => request('GET', '/command/gateway/status'),
  getGatewayLogs:      (limit = 30) => request('GET', `/command/gateway/logs?limit=${limit}`),
  getGatewayExplainer: () => request('GET', '/command/gateway/explainer'),

  // ── Vocabulary ──
  getVocab: () => request('GET', '/command/vocab'),
  addDeviceAlias:  (alias, deviceId) => request('POST', '/command/vocab/device',  { alias, deviceId }),
  addActionAlias:  (alias, action)   => request('POST', '/command/vocab/action',  { alias, action }),
  addCustomCommand: (data)           => request('POST', '/command/vocab/command', data),
  deleteCustomCommand: (id)          => request('DELETE', `/command/vocab/command/${id}`),
  deleteAlias: (type, key)           => request('DELETE', '/command/vocab/alias', { type, key }),
};
