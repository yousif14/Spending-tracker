// n8n/code/sms-parser.test.js
import { describe, it, expect } from 'vitest';
import { parseSms } from './sms-parser.js';

const NOW = new Date('2026-10-11T10:00:00+03:00');
const CARD = 'Dear YUSUF, thank you for using your VISA card 4120 for BHD 5.020 at CENTER POINT EAST RIFFA BH-123456 on 10/10 @18:39. Avail Bal BHD 731.176. Tel 17000000';
const CARD_FX = 'Dear YUSUF, thank you for using your VISA card 4120 for AED 313.26 at Mumzworld FZ LLC Dubai AE-047093 on 10/10 @22:23. Avail Bal BHD 697.957. Tel 17000000';
const FAWRI = 'Fawri+ payment BHD6.700, ref: BIB103KA1003TDBR was credited to IBAN ending 6743 on 2026/10/08 21:19. Balance BHD256.292. Tel: 17000000';
const FAWRI_2SP = 'Fawri+ payment BHD161.110, ref: BIB103K9M001G8R1 credited to IBAN ending  5108 on 2026/09/23 14:08. Fee & VAT: BD 0.110. Bal: BHD711.357. Tel: 17000000';
const FAWRI_PHONE = 'Fawri+ payment BHD8.000, ref: BIB103KA3004ZZZD was credited to IBAN ending 0000 on 2026/10/10 19:59. Balance BHD246.342. Tel: 17000000';
const INCOMING = 'Fawri+ payment BHD5.875 received from IBAN 0000 to IBAN 2391 ref. ALS103K9W005O1XF on 2026/10/03 19:41. Balance BHD309.592. Tel 17000000';

describe('parseSms', () => {
  it('parses a card purchase like the current parser', () => {
    expect(parseSms(CARD, NOW)).toMatchObject({
      Date: '2026-10-10', Time: '18:39', Merchant: 'CENTER POINT EAST RIFFA', Amount: 5.02, Currency: 'BHD',
      Name: 'YUSUF', CardEnding: '4120', Source: 'sms', Payee_IBAN: '', _isFawri: false, _isIncoming: false,
    });
  });
  it('keeps the foreign currency for the converter and the merchant suffix', () => {
    expect(parseSms(CARD_FX, NOW)).toMatchObject({ Amount: 313.26, Currency: 'AED', Merchant: 'MUMZWORLD FZ LLC DUBAI AE-047093' });
  });
  it('parses Fawri+ with IBAN', () => {
    expect(parseSms(FAWRI, NOW)).toMatchObject({
      Date: '2026-10-08', Time: '21:19', Merchant: 'FAWRI_PENDING', Amount: 6.7, Currency: 'BHD',
      Name: 'Card', Payee_IBAN: '6743', Source: 'fawri', _isFawri: true, _isIncoming: false,
    });
  });
  it('tolerates the double space and fee text', () => {
    expect(parseSms(FAWRI_2SP, NOW)).toMatchObject({ Payee_IBAN: '5108', Amount: 161.11, Date: '2026-09-23', Time: '14:08' });
  });
  it('keeps 0000 IBAN (phone payment)', () => {
    expect(parseSms(FAWRI_PHONE, NOW).Payee_IBAN).toBe('0000');
  });
  it('flags incoming money', () => {
    expect(parseSms(INCOMING, NOW)).toMatchObject({ _isIncoming: true, Amount: 5.875, Payee_IBAN: '2391' });
  });
  it('handles empty input', () => {
    expect(parseSms('', NOW)).toMatchObject({ Amount: 0, Merchant: ' ', _isFawri: false, _isIncoming: false });
  });
});
