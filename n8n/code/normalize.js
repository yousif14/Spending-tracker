// n8n/code/normalize.js — shared by migration script, n8n Code nodes and the app
export const CATEGORY_RENAMES = { Luandry: 'Laundry', Patrol: 'Petrol', other: 'Other' };

export function toIsoDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export function toHHMM(v) {
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

export function normalizeCategory(v) {
  const s = String(v ?? '').trim();
  return CATEGORY_RENAMES[s] ?? s;
}

// "Card" with no card ending = rows created by the SMS parser from Fawri+ messages (no "Dear NAME")
export function inferSource(row) {
  if (row.Source) return row.Source;
  if (row.Name === '-') return 'manual';
  if (row.Name === 'Benefit') return 'fawri';
  if (row.Name === 'Card' && !row.Card_ending) return 'fawri';
  return 'sms';
}
