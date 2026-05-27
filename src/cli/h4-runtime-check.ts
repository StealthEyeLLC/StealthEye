import { ensureH4RuntimeSurfaces } from '../lib/h4.js';
const out = ensureH4RuntimeSurfaces();
if (!out.integrity.ok) throw new Error(`h4-runtime-check-failed:${out.integrity.failures.join(',')}`);
console.log('h4 runtime check passed');
