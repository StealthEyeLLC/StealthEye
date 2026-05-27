import { recordH1, runBrowserProof, writeH1Foundation } from '../lib/h1.js';
(async()=>{
  writeH1Foundation();
  const packet = await runBrowserProof(process.cwd(),'proof');
  recordH1('h1:browser:proof',packet as any);
  if (packet.status !== 'ok') process.exitCode = 1;
})();
