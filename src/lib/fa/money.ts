const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** BHD amount: always 3 decimals, grouped thousands */
export const bhd = (n: number) => fmt.format(Number.isFinite(n) ? n : 0);

/** Typed amount → number rounded to fils; accepts a comma as decimal separator */
export const parseAmount = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
};
