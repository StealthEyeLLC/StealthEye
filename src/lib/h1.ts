import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap, type BootstrapContext } from './bootstrap.js';
import { emitRunEvidence, readJson, writeHandoff, writeReplayReceipt } from './substrate.js';

export const H1_FAILURE_CLASSES = ['browser-launch-failed','selector-not-found','navigation-timeout','console-error','network-error','flaky-run','auth-required','external-blocked','trace-corrupt','repair-needed'];

export function h1Bootstrap(root=process.cwd()): BootstrapContext { const ctx=bootstrap(root); mkdirSync(resolve(root,'.stealtheye/browser'),{recursive:true}); return ctx; }

export function writeH1Foundation(root=process.cwd()) {
  h1Bootstrap(root);
  const adapters={schema_version:'1.0.0',adapters:[
    adapter('normal-chatgpt',['planning','classification'],1,'low'),adapter('codex',['code-execution','repair'],3,'medium'),adapter('github-actions',['ci-proof','artifact-upload'],2,'medium'),adapter('browser-playwright',['smoke','proof','screenshot','trace','console-log','network-log','dom-summary','repair-packet-generation'],2,'medium'),adapter('browser-stagehand',['multi-step-browser'],4,'high'),adapter('agent-mode',['multi-app-orchestration'],5,'high'),adapter('future-mcp-placeholder',['reserved'],6,'high')
  ]};
  const browserCaps={schema_version:'1.0.0',capabilities:['smoke','proof','screenshot','trace','console-log','network-log','dom-summary','repair-packet-generation']};
  const routing={policy:'low-cost-first',browser_only_when_necessary:true,codex_escalation_justified_only:true,agent_mode_for_multi_app_only:true,routing_confidence:0.86,avoidable_escalation_detection:true,escalation_explanations:['browser needed only when evidence requires DOM/runtime','codex only for execution repair']};
  const schemas = {
    BrowserTaskContractV0:{type:'object',required:['objective','allowedDomains','expectedEvidence','stopConditions','artifactPolicy','retryPolicy','approvalBoundaries']},
    BrowserEvidencePacketV0:{type:'object',required:['status','evidence','failures','nextAction']},
    BrowserFailurePacketV0:{type:'object',required:['failureClass','summary','evidenceRefs','likelyCause','nextCommand']},
    ExecutionAdapterV0:{type:'object',required:['name','capabilities','routingCost','escalationLevel','approvalGates','reliabilityScore','evidenceOutputs','allowedOperations','failureClasses']}
  };
  const retry={max_retries:2,flake_detection:true,classifiers:['likely-flake','deterministic-failure','environment-failure','transient-network'],infinite_loop_prevention:true};
  const sec={forbidden:['credential-entry','payment-flows','secret-exposure','unrestricted-browser-wandering'],allowed_domain_policy:'allowlist-only',approval_gated_operations:['auth','payments','secrets']};
  const normalizer={schema_version:'1.0.0',normalized_fields:['status','evidence','blockers','failures','next_action','escalation_reason'],sources:['playwright','github-actions','codex','agent-mode']};
  const processes=['h1.execution-adapter-bootstrap','h1.browser-smoke','h1.browser-proof','h1.browser-repair','h1.github-actions-proof','h1.agent-mode-route','h1.codex-execution-route'];
  const anti={forbidden:['uncontrolled-browser-execution','unmanaged-artifacts','hidden-side-effects','unrestricted-external-browsing','product-feature-work','credential-payment-handling']};
  write('.stealtheye/state/execution-adapter-registry.json',adapters,root); write('.stealtheye/state/browser-capability-registry.json',browserCaps,root); write('.stealtheye/state/browser-routing-governance.json',routing,root);
  write('.stealtheye/state/browser-retry-governance.json',retry,root); write('.stealtheye/state/browser-security-boundaries.json',sec,root); write('.stealtheye/state/execution-result-normalizer.json',normalizer,root);
  write('.stealtheye/schemas/h1-contracts.schema.json',schemas,root); write('.stealtheye/processes/h1-process-catalog.json',{processes},root); write('.stealtheye/state/h1-anti-invariants.json',anti,root);
}

export function evidencePacket(status='ok', root=process.cwd()) {
  const packet={status,evidence:{screenshots:[],console_errors:[],failed_requests:[],trace_refs:[],dom_summary:'compact'},blockers:[],failures:[],next_action:'npm run h1:validate',escalation_reason:'none'};
  write('.stealtheye/receipts/h1-browser-evidence-packet.json',packet,root); return packet;
}
export function repairPacket(failureClass='repair-needed', root=process.cwd()) { const p={failure_summary:failureClass,suspected_files:['src/lib/h1.ts'],evidence_refs:['.stealtheye/receipts/h1-browser-evidence-packet.json'],replay_refs:['.stealtheye/receipts/latest-replay.json'],likely_cause:'deterministic classification',next_command:'npm run h1:browser:proof',escalation_recommendation:'codex-if-repeated'}; write('.stealtheye/receipts/h1-browser-repair-packet.json',p,root); return p; }
function adapter(name:string,capabilities:string[],routingCost:number,escalationLevel:string){return{name,capabilities,routingCost,escalationLevel,approvalGates:['secrets','billing','destructive-delete'],reliabilityScore:0.8,evidenceOutputs:['summary','packet'],allowedOperations:['bounded-execution'],failureClasses:H1_FAILURE_CLASSES};}
function write(path:string,obj:unknown,root:string){const abs=resolve(root,path);mkdirSync(resolve(abs,'..'),{recursive:true});writeFileSync(abs,JSON.stringify(obj,null,2));}

export function recordH1(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
export function loadH1Readiness(root=process.cwd()){return readJson(resolve(root,'.stealtheye/validation/h1-readiness.json'),{status:'partial'});}
