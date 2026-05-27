import { h3Smoke, recordH3 } from '../lib/h3.js';
const out = h3Smoke('repair');
recordH3('h3:repair:smoke', out as any);
console.log(JSON.stringify(out, null, 2));
