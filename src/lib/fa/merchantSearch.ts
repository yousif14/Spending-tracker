import type { MerchantRef } from './types';

/** Rank: whole-name prefix > word prefix > substring, then by how often the merchant appears */
export function searchMerchants(list: MerchantRef[], q: string, limit = 6): MerchantRef[] {
  const s = q.trim().toLowerCase();
  const rank = (m: MerchantRef) => {
    const n = m.merchant.toLowerCase();
    return !s ? 1 : n.startsWith(s) ? 3 : n.split(/\s+/).some(w => w.startsWith(s)) ? 2 : n.includes(s) ? 1 : 0;
  };
  return list.map(m => ({ m, r: rank(m) })).filter(x => x.r > 0)
    .sort((a, b) => b.r - a.r || b.m.count - a.m.count).slice(0, limit).map(x => x.m);
}
