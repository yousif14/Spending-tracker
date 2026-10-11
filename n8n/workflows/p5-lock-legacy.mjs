// n8n/workflows/p5-lock-legacy.mjs — the new app replaced the old webhooks: deactivate FA - Get / Update Transaction / Merchant,
// and require X-FA-Key on manualAddTransaction. usage: node p5-lock-legacy.mjs [--apply|--undo]
import { api, getWorkflow, putWorkflow, IDS } from '../scripts/n8n-client.mjs';

const LEGACY = { aoVZmvgR3GRTC8kR: 'FA - Get', PAVfWilnR0E9msqA: 'FA - Update Transaction', EGiQwEDvAKgHXebK: 'FA - Merchant' };
const undo = process.argv.includes('--undo'), apply = process.argv.includes('--apply') || undo;

for (const [id, name] of Object.entries(LEGACY)) {
  const wf = await getWorkflow(id);
  console.log(`${name}: active=${wf.active}`);
  if (apply) { await api('POST', `/workflows/${id}/${undo ? 'activate' : 'deactivate'}`); console.log(`  → ${undo ? 'activated' : 'deactivated'}`); }
}

const wf = await getWorkflow('I3EaJw8o1YNfkleN');
const hook = wf.nodes.find(n => n.type === 'n8n-nodes-base.webhook' && n.parameters.path === 'manualAddTransaction');
if (!hook) throw new Error('manualAddTransaction webhook not found');
console.log(`${hook.name}: auth=${hook.parameters.authentication || 'none'}`);
if (undo) { delete hook.parameters.authentication; delete hook.credentials; }
else { hook.parameters.authentication = 'headerAuth'; hook.credentials = { httpHeaderAuth: { id: IDS.credFaKey, name: 'FA App Key' } }; }
if (apply) { await putWorkflow({ ...wf, active: true }); console.log(`  → auth=${hook.parameters.authentication || 'none'}`); }
