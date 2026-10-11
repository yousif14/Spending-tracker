// n8n/scripts/n8n-client.mjs — minimal n8n public API client (Node 18+)
import { readFileSync } from 'node:fs';

const BASE = process.env.N8N_BASE_URL || 'https://n8n.11homelab.cc/api/v1';
const KEY_FILE = process.env.N8N_API_KEY_FILE || 'C:/data/n8n/n8n_Api/n8n_api.env';
const KEY = (process.env.N8N_API_KEY || readFileSync(KEY_FILE, 'utf8')).trim();

export async function api(method, path, body, query) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const res = await fetch(url, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'User-Agent': 'fa-tools/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

// Follows nextCursor for any paginated list endpoint.
export async function listAll(path, query = {}) {
  const items = [];
  let cursor;
  do {
    const page = await api('GET', path, undefined, { ...query, cursor });
    items.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export async function allRows(tableId) {
  return listAll(`/data-tables/${tableId}/rows`, { limit: '250' });
}

export const eq = (columnName, value) => ({ type: 'and', filters: [{ columnName, condition: 'eq', value }] });

export async function updateRows(tableId, filter, data) {
  return api('PATCH', `/data-tables/${tableId}/rows/update`, { filter, data });
}

export async function insertRows(tableId, data) {
  return api('POST', `/data-tables/${tableId}/rows`, { data, returnType: 'id' });
}

const SETTINGS_KEYS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];

export async function getWorkflow(id) { return api('GET', `/workflows/${id}`); }

export async function putWorkflow(wf) {
  const settings = Object.fromEntries(Object.entries(wf.settings || {}).filter(([k]) => SETTINGS_KEYS.includes(k)));
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
  const out = await api('PUT', `/workflows/${wf.id}`, body);
  if (wf.active) await api('POST', `/workflows/${wf.id}/activate`);
  return out;
}

export const TABLES = { transactions: 'wWtvo201WLTNBcqr', catList: 'IGDY61HhMcKpjvDT' };
export const PROJECT_ID = 'rb6hVXbCTjBQVHmt';
