// n8n/scripts/backup.mjs — snapshot ALL workflows + ALL data tables to <FA_BACKUP_DIR>/<stamp>/
// default dir: C:/data/n8n/n8n_Api/backups
import { mkdirSync, writeFileSync } from 'node:fs';
import { listAll, allRows, getWorkflow } from './n8n-client.mjs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = `${process.env.FA_BACKUP_DIR || 'C:/data/n8n/n8n_Api/backups'}/${stamp}`;
mkdirSync(dir, { recursive: true });

const workflows = await listAll('/workflows', { limit: '250' });
for (const w of workflows) writeFileSync(`${dir}/wf-${w.id}.json`, JSON.stringify(await getWorkflow(w.id), null, 1));

const tables = await listAll('/data-tables', { limit: '100' });
const summary = { stamp, workflows: workflows.length, tables: {} };
for (const t of tables) {
  const rows = await allRows(t.id);
  // table-<name>.json is what restore.mjs looks up; fall back to name+id if two tables share a name
  const dupe = tables.filter(x => x.name === t.name).length > 1;
  writeFileSync(`${dir}/table-${dupe ? `${t.name}-${t.id}` : t.name}.json`, JSON.stringify({ table: t, rows }, null, 1));
  const amount = rows.some(r => 'Amount' in r) ? rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0).toFixed(3) : undefined;
  summary.tables[t.name] = { id: t.id, rows: rows.length, amount };
  console.log(`${t.name}: ${rows.length} rows${amount ? `, Amount sum ${amount}` : ''}`);
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 1));
console.log(`workflows: ${workflows.length}\nbackup: ${dir}`);
