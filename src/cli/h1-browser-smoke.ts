import { recordH1, runBrowserProof, writeH1Foundation } from '../lib/h1.js';
(async()=>{
  writeH1Foundation();
  const packet = await runBrowserProof(process.cwd(),'smoke');
  recordH1('h1:browser:smoke',packet as any);
  if (packet.status === 'failed') process.exitCode = 1;
})();
