import { readJson } from '../lib/substrate.js';
import { recordH1 } from '../lib/h1.js';
const routing=readJson('.stealtheye/state/browser-routing-governance.json',{policy:'missing'});
console.log(JSON.stringify(routing,null,2));
recordH1('h1:route',{status:'ok',routing});
