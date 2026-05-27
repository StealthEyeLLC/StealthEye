import { h3Packet, recordH3 } from '../lib/h3.js';
const out = h3Packet();
recordH3('h3:packet', out as any);
console.log(JSON.stringify(out, null, 2));
