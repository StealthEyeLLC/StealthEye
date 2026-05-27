import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { bootstrap, type BootstrapContext } from './bootstrap.js';
import { emitRunEvidence, readJson, writeHandoff, writeReplayReceipt } from './substrate.js';

export const H1_FAILURE_CLASSES = ['browser-launch-failed','selector-not-found','navigation-timeout','console-error','network-error','flaky-run','auth-required','external-blocked','trace-corrupt','repair-needed','binary-missing','cdn-blocked','permission-issue','sandbox-issue','dependency-failure'];

type EnvClass = 'codex-restricted'|'github-actions'|'local-browser-available'|'browser-missing'|'external-blocked';

export function h1Bootstrap(root=process.cwd()): BootstrapContext { const ctx=bootstrap(root); mkdirSync(resolve(root,'.stealtheye/browser'),{recursive:true}); return ctx; }

export function detectEnvironment(root=process.cwd()) {
  h1Bootstrap(root);
  const ua = process.env.CI ? 'github-actions' : process.env.CODEX_SANDBOX || process.env.CODESPACES ? 'codex-restricted' : 'local';
  const hasLocal = detectLocalBrowser();
  const externalBlocked = detectExternalBlocked();
  const classes: EnvClass[] = [];
  if (ua === 'github-actions') classes.push('github-actions');
  if (ua === 'codex-restricted') classes.push('codex-restricted');
  if (hasLocal) classes.push('local-browser-available'); else classes.push('browser-missing');
  if (externalBlocked) classes.push('external-blocked');
  const out={schema_version:'1.0.0',environment:ua,classes,runtime_source:hasLocal?'preinstalled-browser':'playwright-managed',external_blocked:externalBlocked,local_browser_paths:findLocalBrowsers()};
  write('.stealtheye/state/h1-runtime-posture.json',out,root);
  return out;
}

export async function acquireRuntime(root=process.cwd()) {
  const posture = detectEnvironment(root);
  const attempts: string[] = [];
  if (posture.classes.includes('local-browser-available')) return { ok:true, source:'preinstalled-browser', attempts:['local-browser-detected'], diagnostics:[] as string[] };
  attempts.push('playwright-install');
  try { execSync('npx playwright install chromium',{stdio:'pipe'}); return { ok:true, source:'playwright-managed-runtime', attempts, diagnostics:[] as string[] }; }
  catch (e:any) {
    const diagnostics = classifyRuntimeError(String(e?.stderr||e?.message||e));
    const fallback = posture.classes.includes('github-actions') ? 'ci-browser-workflow' : 'repair-packet-escalation';
    return { ok:false, source:'none', attempts:[...attempts,fallback], diagnostics };
  }
}

export async function runBrowserProof(root=process.cwd(), mode:'smoke'|'proof'='proof') {
  h1Bootstrap(root);
  const runtime = await acquireRuntime(root);
  const diag:string[] = [];
  const consoleErrors:string[]=[]; const failedRequests:string[]=[];
  const start=Date.now();
  if (!runtime.ok) {
    const repair = createRepair('external-blocked', runtime.diagnostics, root, false);
    const packet = normalizeEvidence({ status:'failed', runtime, consoleErrors:[], failedRequests:[], domSummary:'', launchOk:false, screenshotOk:false, traceOk:false, confidence:scoreConfidence(false,false,false,0,0,true), mode, duration_ms:Date.now()-start, diagnostics:runtime.diagnostics, repair }, root);
    write('.stealtheye/receipts/h1-browser-evidence-packet.json',packet,root);
    return packet;
  }
  let browser:any; let launchOk=false; let screenshotOk=false; let traceOk=false; let domSummary='';
  try {
    browser = await chromium.launch({ headless: true }); launchOk=true;
    const context = await browser.newContext();
    await context.tracing.start({ screenshots:true, snapshots:true });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type()==='error') consoleErrors.push(msg.text()); });
    page.on('requestfailed', req => failedRequests.push(req.url()));
    await page.goto('https://example.com',{waitUntil:'domcontentloaded',timeout:20000});
    await page.screenshot({ path: '.stealtheye/browser/smoke.png', fullPage:true }); screenshotOk=true;
    domSummary = await page.evaluate(() => JSON.stringify({ title: document.title, links: document.querySelectorAll('a').length, text: document.body?.innerText?.slice(0,120) ?? '' }));
    const tracePath = '.stealtheye/browser/trace.zip';
    await context.tracing.stop({ path: tracePath }); traceOk = existsSync(resolve(root,tracePath));
    await browser.close();
    const confidence=scoreConfidence(launchOk,screenshotOk,traceOk,consoleErrors.length,failedRequests.length,false);
    const packet=normalizeEvidence({status:'ok',runtime,consoleErrors,failedRequests,domSummary,launchOk,screenshotOk,traceOk,confidence,mode,duration_ms:Date.now()-start},root);
    write('.stealtheye/receipts/h1-browser-evidence-packet.json',packet,root);
    write('.stealtheye/state/h1-runtime-metadata.json',{runtime,mode,confidence,last_success_at:new Date().toISOString()},root);
    return packet;
  } catch (e:any) {
    if (browser) await browser.close().catch(()=>{});
    diag.push(...classifyRuntimeError(String(e?.message||e)));
    const repair=createRepair('browser-launch-failed',diag,root,true);
    const confidence=scoreConfidence(launchOk,screenshotOk,traceOk,consoleErrors.length,failedRequests.length,true);
    const packet=normalizeEvidence({status:'failed',runtime,consoleErrors,failedRequests,domSummary,launchOk,screenshotOk,traceOk,confidence,mode,duration_ms:Date.now()-start,diagnostics:diag,repair},root);
    write('.stealtheye/receipts/h1-browser-evidence-packet.json',packet,root);
    return packet;
  }
}

function detectLocalBrowser() { return findLocalBrowsers().length>0; }
function findLocalBrowsers() { const cands=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']; return cands.filter(existsSync); }
function detectExternalBlocked() { try { execSync('curl -I -s https://cdn.playwright.dev | head -n 1',{stdio:'pipe'}); return false; } catch { return true; } }
function classifyRuntimeError(raw:string){ const r=raw.toLowerCase(); const d:string[]=[]; if (r.includes('403')||r.includes('cdn')||r.includes('download failed')) d.push('cdn-blocked'); if (r.includes('permission denied')||r.includes('eacces')) d.push('permission-issue'); if (r.includes('sandbox')) d.push('sandbox-issue'); if (r.includes('lib')||r.includes('dependency')) d.push('dependency-failure'); if (r.includes('executable')||r.includes('browser')||r.includes('not found')) d.push('binary-missing'); if (!d.length) d.push('launch-failure'); return [...new Set(d)]; }
function scoreConfidence(launch:boolean,screenshot:boolean,trace:boolean,consoleErrs:number,networkFails:number,failed:boolean){ const base=(launch?0.35:0)+(screenshot?0.2:0)+(trace?0.2:0)+Math.max(0,0.15-consoleErrs*0.03)+Math.max(0,0.1-networkFails*0.02)-(failed?0.25:0); return Number(Math.max(0,Math.min(1,base)).toFixed(3)); }
function normalizeEvidence(payload:any,root:string){ const compact={status:payload.status,mode:payload.mode,confidence:payload.confidence,runtime_source:payload.runtime.source,evidence:{screenshots:['.stealtheye/browser/smoke.png'],traces:['.stealtheye/browser/trace.zip'],console_errors:payload.consoleErrors.slice(0,5),failed_requests:payload.failedRequests.slice(0,5),dom_summary:payload.domSummary.slice(0,180)},runtime_metadata:{attempts:payload.runtime.attempts,diagnostics:payload.runtime.diagnostics??payload.diagnostics??[],duration_ms:payload.duration_ms},validation:{launch:payload.launchOk,screenshot:payload.screenshotOk,trace:payload.traceOk,console_network:payload.consoleErrors.length===0&&payload.failedRequests.length===0,dom:payload.domSummary.length>0},repair:payload.repair??null,mobile_summary:`${payload.status}|c=${payload.confidence}|rt=${payload.runtime.source}|ce=${payload.consoleErrors.length}|nf=${payload.failedRequests.length}`};
  write('.stealtheye/state/h1-browser-latest.json',compact,root); return compact;
}
function createRepair(failureClass:string,diagnostics:string[],root:string,retryable:boolean){ const probableRootCause=diagnostics.includes('cdn-blocked')?'external-blocked':diagnostics[0]??failureClass; const deterministicNextAction=diagnostics.includes('cdn-blocked')?'run-ci-browser-proof':'emit-repair-packet'; const repair={failure_summary:failureClass,repair_target: probableRootCause.includes('sandbox')?'environment':'runtime',probable_root_cause:probableRootCause,retry_recommendation: retryable?'bounded-retry-1':'no-local-retry',escalation_recommendation: diagnostics.includes('cdn-blocked')?'github-actions-authoritative-lane':'codex-repair-lane',deterministic_next_action:deterministicNextAction,evidence_refs:['.stealtheye/receipts/h1-browser-evidence-packet.json'],diagnostics};
  write('.stealtheye/receipts/h1-browser-repair-packet.json',repair,root); return repair;
}

export function writeH1Foundation(root=process.cwd()) { /* existing + hardened */
  h1Bootstrap(root); detectEnvironment(root);
  const anti={forbidden:['uncontrolled-browser-execution','unmanaged-artifacts','hidden-side-effects','unrestricted-external-browsing','product-feature-work','credential-payment-handling','uncontrolled-browser-retries','silent-runtime-fallback-ambiguity']};
  write('.stealtheye/state/h1-anti-invariants.json',anti,root);
}

export function recordH1(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
export function loadH1Readiness(root=process.cwd()){return readJson(resolve(root,'.stealtheye/validation/h1-readiness.json'),{status:'partial'});}
function write(path:string,obj:unknown,root:string){const abs=resolve(root,path);mkdirSync(resolve(abs,'..'),{recursive:true});writeFileSync(abs,JSON.stringify(obj,null,2));}
