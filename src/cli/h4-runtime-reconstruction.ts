import { runH4RuntimeReconstruction } from '../lib/h4-runtime-reconstruction.js';

const out = runH4RuntimeReconstruction(process.cwd());
console.log(JSON.stringify(out, null, 2));
