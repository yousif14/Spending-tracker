// n8n/workflows/p3-lock-iphone-webhook.mjs — "From iPhone (Webhook)" requires X-FA-Key. usage: node p3-lock-iphone-webhook.mjs [--apply|--undo]
import { getWorkflow, putWorkflow, IDS } from '../scripts/n8n-client.mjs';
import { node } from '../scripts/wf-edit.mjs';

const wf = await getWorkflow('I3EaJw8o1YNfkleN');
const n = node(wf, 'From iPhone (Webhook)');
console.log('before:', n.parameters.authentication || 'none', JSON.stringify(n.credentials || {}));
if (process.argv.includes('--undo')) {
  delete n.parameters.authentication; delete n.credentials;
} else {
  n.parameters.authentication = 'headerAuth';
  n.credentials = { httpHeaderAuth: { id: IDS.credFaKey, name: 'FA App Key' } };
}
console.log('after: ', n.parameters.authentication || 'none', JSON.stringify(n.credentials || {}));
if (process.argv.includes('--apply') || process.argv.includes('--undo')) { await putWorkflow({ ...wf, active: true }); console.log('applied'); }
