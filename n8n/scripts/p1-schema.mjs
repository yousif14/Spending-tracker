// n8n/scripts/p1-schema.mjs — idempotent: creates Categories + Settings tables and the new transaction columns
import { api, allRows, insertRows, TABLES, PROJECT_ID } from './n8n-client.mjs';
import { normalizeCategory } from '../code/normalize.js';

const COLORS = { Food:'#E07A5F', Groceries:'#3D8B6E', Drink:'#C08552', Travel:'#4A7FB5', Shopping:'#B5568A',
  Subscription:'#6C63B5', 'Health Care':'#D1495B', Petrol:'#8C6D46', Sport:'#2A9D8F', Gifts:'#E9A23B',
  Car:'#5A6B7B', Baby:'#8A6FD1', Laundry:'#4BA3C3', Grooming:'#C77DFF', Services:'#6B8F71', Clothing:'#D4706B',
  Investment:'#2F7D4F', Furniture:'#9C7A54', Other:'#8A9490' };
const ICONS = { Food:'UtensilsCrossed', Groceries:'ShoppingCart', Drink:'Coffee', Travel:'Plane', Shopping:'ShoppingBag',
  Subscription:'Tv', 'Health Care':'Heart', Petrol:'Fuel', Sport:'Dumbbell', Gifts:'Gift', Car:'Car', Baby:'Baby',
  Laundry:'Wind', Grooming:'Scissors', Services:'Wrench', Clothing:'Shirt', Investment:'TrendingUp', Furniture:'Sofa', Other:'Package' };

const tables = (await api('GET', '/data-tables', undefined, { limit: '100' })).data;
const byName = n => tables.find(t => t.name === n);

let cat = byName('Categories');
if (!cat) {
  cat = await api('POST', '/data-tables', { name: 'Categories', projectId: PROJECT_ID, columns: [
    { name: 'Name', type: 'string' }, { name: 'Color', type: 'string' }, { name: 'Icon', type: 'string' },
    { name: 'Budget', type: 'number' }, { name: 'Order', type: 'number' }, { name: 'Active', type: 'boolean' } ] });
  // Seed from distinct categories used in transactions, most used first; skip "Fawri+" (not a real category)
  const tx = await allRows(TABLES.transactions);
  const counts = {};
  for (const r of tx) { const c = normalizeCategory(r.Category); if (c && c !== 'Fawri+') counts[c] = (counts[c] || 0) + 1; }
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  await insertRows(cat.id, names.map((n, i) => ({ Name: n, Color: COLORS[n] || '#8A9490', Icon: ICONS[n] || 'Tag', Budget: 0, Order: i + 1, Active: true })));
  console.log('Categories created + seeded:', names.join(', '));
} else console.log('Categories exists', cat.id);

let settings = byName('Settings');
if (!settings) {
  settings = await api('POST', '/data-tables', { name: 'Settings', projectId: PROJECT_ID, columns: [
    { name: 'Key', type: 'string' }, { name: 'Value', type: 'string' } ] });
  await insertRows(settings.id, [{ Key: 'total_budget', Value: '600' }]);
  console.log('Settings created', settings.id);
} else console.log('Settings exists', settings.id);

// GET /data-tables/{id}/columns is 403 for this API key; the table list already carries the columns
const cols = (byName('transactions').columns || []).map(c => c.name);
for (const name of ['Payee_IBAN', 'Source']) {
  if (!cols.includes(name)) { await api('POST', `/data-tables/${TABLES.transactions}/columns`, { name, type: 'string' }); console.log('added column', name); }
}
console.log(`CATEGORIES_TABLE=${cat.id}\nSETTINGS_TABLE=${settings.id}`);
