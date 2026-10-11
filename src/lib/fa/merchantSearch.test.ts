import { describe, it, expect } from 'vitest';
import { searchMerchants } from './merchantSearch';

const M = [{ merchant: 'JASMIS', category: 'Food', count: 30 }, { merchant: 'JASMINE CAFE', category: 'Drink', count: 2 },
  { merchant: 'CAFE JAS', category: 'Drink', count: 50 }, { merchant: 'LULU', category: 'Groceries', count: 80 }];

describe('searchMerchants', () => {
  it('prefix beats contains, then frequency', () => expect(searchMerchants(M, 'jas').map(m => m.merchant)).toEqual(['JASMIS', 'JASMINE CAFE', 'CAFE JAS']));
  it('empty query → most frequent', () => expect(searchMerchants(M, '', 2).map(m => m.merchant)).toEqual(['LULU', 'CAFE JAS']));
});
