import { h3Smoke, recordH3 } from '../lib/h3.js';
const out = await h3Smoke('mission');
recordH3('h3:mission:smoke', out as any);
console.log(JSON.stringify(out, null, 2));
