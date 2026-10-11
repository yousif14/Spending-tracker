// n8n/scripts/wf-edit.mjs — small helpers to edit workflow JSON safely
import { randomUUID } from 'node:crypto';
export const node = (wf, name) => { const n = wf.nodes.find(n => n.name === name); if (!n) throw new Error('no node ' + name); return n; };
export function clone(wf, templateName, newName, patch = {}, dx = 0, dy = 220) {
  if (wf.nodes.some(n => n.name === newName)) return node(wf, newName);          // idempotent
  const t = structuredClone(node(wf, templateName));
  const n = { ...t, ...patch, id: randomUUID(), name: newName, position: [t.position[0] + dx, t.position[1] + dy] };
  if (patch.parameters) n.parameters = patch.parameters;
  delete n.webhookId;
  wf.nodes.push(n); return n;
}
export function connect(wf, from, to, fromIndex = 0) {
  wf.connections[from] ??= { main: [] };
  const outs = wf.connections[from].main;
  while (outs.length <= fromIndex) outs.push([]);
  if (!outs[fromIndex].some(c => c.node === to)) outs[fromIndex].push({ node: to, type: 'main', index: 0 });
}
export function disconnect(wf, from, to) {
  for (const outs of wf.connections[from]?.main || []) {
    const i = (outs || []).findIndex(c => c.node === to); if (i >= 0) outs.splice(i, 1);
  }
}
export function setCode(wf, name, js) { node(wf, name).parameters.jsCode = js; }
