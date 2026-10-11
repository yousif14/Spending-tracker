// n8n/scripts/restore.mjs — dry run by default; --apply is needed to change anything.
//   node restore.mjs --dir <backup dir> --table transactions [--apply]                 restore one table's rows (delete all, re-insert)
//   node restore.mjs --dir <backup dir> --table transactions --into <tableId> [--apply] restore into another table
//   node restore.mjs --dir <backup dir> --table transactions --into new --apply        create "restore_drill_<stamp>" with the backup's columns and restore into it (test restore)
//   node restore.mjs --dir <backup dir> --workflow <id> [--apply]                       restore one workflow (nodes, connections, settings, active state)
import { readFileSync, existsSync } from 'node:fs';
import { api, allRows, putWorkflow } from './n8n-client.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const dir = arg('--dir'); if (!dir) throw new Error('--dir required');
const SYSTEM = new Set(['id', 'createdAt', 'updatedAt']);

const strip = r => Object.fromEntries(Object.entries(r).filter(([k]) => !SYSTEM.has(k)));
const sum = a => a.reduce((s, r) => s + (Number(r.Amount) || 0), 0).toFixed(3);
// Order-independent fingerprint of row contents (system columns ignored, keys sorted).
const fingerprint = rows => rows
  .map(r => JSON.stringify(Object.keys(strip(r)).sort().map(k => [k, r[k] ?? null])))
  .sort().join('\n');

if (arg('--table')) {
  const file = `${dir}/table-${arg('--table')}.json`;
  if (!existsSync(file)) throw new Error('no backup for table ' + arg('--table'));
  const { table, rows } = JSON.parse(readFileSync(file, 'utf8'));
  let target = arg('--into') || table.id;

  if (target === 'new') {
    if (!APPLY) { console.log(`would create restore_drill table with ${table.columns.length} columns and restore ${rows.length} rows`); process.exit(0); }
    const columns = [...table.columns].sort((a, b) => a.index - b.index).map(c => ({ name: c.name, type: c.type }));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    target = (await api('POST', '/data-tables', { name: `restore_drill_${stamp}`, projectId: table.projectId, columns })).id;
    console.log(`DRILL=${target}`);
  }

  const live = await allRows(target);
  console.log(`table ${table.name} → ${target}: live ${live.length} rows, backup ${rows.length} rows; Amount sum live ${sum(live)} backup ${sum(rows)}`);
  if (APPLY) {
    // Columns added after the backup (e.g. Payee_IBAN, Source) are simply left empty; drop them separately if needed.
    if (live.length) await api('DELETE', `/data-tables/${target}/rows/delete`, undefined,
      { filter: { type: 'and', filters: [{ columnName: 'id', condition: 'gt', value: 0 }] } });
    const clean = rows.map(strip);
    for (let i = 0; i < clean.length; i += 200) await api('POST', `/data-tables/${target}/rows`, { data: clean.slice(i, i + 200) });
    const after = await allRows(target);
    console.log(`restored: ${after.length} rows, Amount sum ${sum(after)}`);
    if (after.length !== rows.length) throw new Error('ROW COUNT MISMATCH — stop and investigate');
    if (fingerprint(after) !== fingerprint(rows)) throw new Error('ROW CONTENT MISMATCH — stop and investigate');
    console.log('row contents match the backup');
  }
}

if (arg('--workflow')) {
  const wf = JSON.parse(readFileSync(`${dir}/wf-${arg('--workflow')}.json`, 'utf8'));
  console.log(`workflow ${wf.name} (${wf.id}) nodes ${wf.nodes.length} active ${wf.active}`);
  if (APPLY) {
    await putWorkflow(wf);
    if (!wf.active) await api('POST', `/workflows/${wf.id}/deactivate`).catch(() => {});
    console.log('restored');
  }
}
