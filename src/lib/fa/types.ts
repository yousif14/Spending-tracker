// FA App API shapes (see n8n/code/feed.js and docs/SYSTEM-MAP.md "App API")
export type Source = 'sms' | 'fawri' | 'manual';

export interface Tx {
  sn: string; date: string; time: string; merchant: string; amount: number; currency: string;
  category: string; tag: string; name: string; cardEnding: string; payeeIban: string; source: Source;
}

export interface Cat { id: number; name: string; color: string; icon: string; budget: number; order: number; active: boolean; }

export interface MerchantRef { merchant: string; category: string; count: number; }

export interface Feed {
  success: true; generatedAt: string; transactions: Tx[]; categories: Cat[]; merchants: MerchantRef[];
  settings: { total_budget?: number; [k: string]: unknown };
}

export interface NewTx { date: string; time?: string; merchant: string; amount: number; category: string; tag?: string; }
