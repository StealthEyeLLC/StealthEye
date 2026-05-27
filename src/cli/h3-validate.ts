import { h3Validate, recordH3 } from '../lib/h3.js';
const out = h3Validate();
recordH3('h3:validate', out as any);
console.log(JSON.stringify(out, null, 2));
