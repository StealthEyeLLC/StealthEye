import { h3Inspect, recordH3 } from '../lib/h3.js';
const out = await h3Inspect();
recordH3('h3:inspect', out as any);
console.log(JSON.stringify(out, null, 2));
