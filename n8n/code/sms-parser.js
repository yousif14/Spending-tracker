// n8n/code/sms-parser.js
export function parseSms(raw, now = new Date()) {
  const sms = String(raw || '').replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const base = { Date: now.toISOString().slice(0, 10), Time: '', Merchant: ' ', Amount: 0, Currency: '', Category: '',
    Tag: '', Name: 'Card', CardEnding: '', Payee_IBAN: '', Source: 'sms', _isFawri: false, _isIncoming: false, _originalSMS: sms };
  if (!sms) return base;

  const isFawri = /^Fawri\+?\s/i.test(sms);
  const isIncoming = isFawri && /received from IBAN/i.test(sms);

  let dateStr = base.Date;
  const mYmd = sms.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  const mOnDdMm = sms.match(/on\s+(\d{2})\/(\d{2})/i);
  if (mYmd) dateStr = `${mYmd[1]}-${mYmd[2]}-${mYmd[3]}`;
  else if (mOnDdMm) dateStr = `${now.getFullYear()}-${mOnDdMm[2]}-${mOnDdMm[1]}`;

  let timeStr = '';
  const mAt = sms.match(/@(\d{1,2}:\d{2})/);
  const mYmdTime = sms.match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{1,2}:\d{2})/);
  const mAnyTime = sms.match(/\b(\d{1,2}:\d{2})\b/);
  if (mAt) timeStr = mAt[1]; else if (mYmdTime) timeStr = mYmdTime[2]; else if (mAnyTime) timeStr = mAnyTime[1];
  if (/^\d:/.test(timeStr)) timeStr = '0' + timeStr;

  let amount = 0, currency = '';
  let mAmt = sms.match(/for\s+([A-Z]{3})\s?(\d+(?:\.\d{1,3})?)/i);
  if (!mAmt) mAmt = sms.match(/(?:^|\s)([A-Z]{3})\s?(\d+(?:\.\d{1,3})?)(?!\d)/i);
  if (mAmt) { currency = mAmt[1].toUpperCase(); amount = parseFloat(mAmt[2].replace(/,/g, '')); }

  let name = 'Card';
  const mName = sms.match(/Dear\s+([A-Z]+)/i);
  if (mName) name = mName[1].trim();

  let merchant = ' ';
  if (!isFawri) {
    const mMerch = sms.match(/at\s+(.+?)\s+(?:on\s+\d{1,2}\/\d{2}|@\d{1,2}:\d{2}|\.)/i) || sms.match(/at\s+(.+?)\s+(on|@)/i);
    if (mMerch) merchant = (mMerch[1] || '').trim().replace(/\s+(?:R?BH-\d+)\s*$/i, '').replace(/\s+BAHRAIN\s*$/i, '').replace(/\s{2,}/g, ' ').trim() || ' ';
  } else merchant = 'FAWRI_PENDING';
  merchant = merchant.toUpperCase();

  let card4 = '';
  const mCard = sms.match(/card(?:\s+\w+)?\s+(\d{4})/i);
  if (mCard) card4 = mCard[1];

  let iban = '';
  const mIban = isIncoming ? sms.match(/to IBAN\s+(\d{4})/i) : sms.match(/IBAN ending\s+(\d{4})/i);
  if (mIban) iban = mIban[1];

  return { ...base, Date: dateStr, Time: timeStr, Merchant: merchant, Amount: Number.isFinite(amount) ? amount : 0,
    Currency: currency, Name: name, CardEnding: card4, Payee_IBAN: iban, Source: isFawri ? 'fawri' : 'sms',
    _isFawri: isFawri && !isIncoming, _isIncoming: isIncoming };
}
