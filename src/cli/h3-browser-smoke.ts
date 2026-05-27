import { h3Smoke, recordH3 } from '../lib/h3.js';
const out = await h3Smoke('browser');
recordH3('h3:browser:smoke', out as any);
console.log(JSON.stringify(out, null, 2));
