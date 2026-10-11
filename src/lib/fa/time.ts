// Bahrain wall-clock helpers (the household's timezone, regardless of the device's)
const parts = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bahrain' }); // "2026-10-11 17:30:05"

export const todayBahrain = () => parts().slice(0, 10);
export const nowBahrain = () => { const p = parts(); return { date: p.slice(0, 10), time: p.slice(11, 16) }; };
