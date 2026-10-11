// n8n/scripts/inline.mjs — inline(['sms-parser.js'], footerSource) → Code node JS (no imports/exports)
import { readFileSync } from 'node:fs';
const CODE_DIR = new URL('../code/', import.meta.url);
export function inline(libs, footer) {
  const body = libs.map(f => readFileSync(new URL(f, CODE_DIR), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export (function|const|let|class) /gm, '$1 ')).join('\n');
  return `// ---- generated from n8n/code: ${libs.join(', ')} — edit there, not here ----\n${body}\n// ---- node logic ----\n${footer.trim()}\n`;
}
