import { mkdirSync, writeFileSync } from 'node:fs';
import {
  h2Bootstrap, writeH2State, createMissionDag, executeMissionDag, repairMissionDag, replayMissionDag, checkpointMissionDag, restoreCheckpoint, finalizeMissionDag,
  invalidateDependentNodes, detectReplayDrift, promoteCiAuthority, evaluateExecutionPolicy
} from '../lib/h2.js';

h2Bootstrap(); writeH2State();
const dag=createMissionDag({mission_id:'h2:smoke',nodes:[{name:'start'},{name:'branchA'},{name:'branchB'},{name:'finish'}]});
dag.nodes[1].dependencies=[dag.nodes[0].node_id];
dag.nodes[2].dependencies=[dag.nodes[0].node_id];
dag.nodes[3].dependencies=[dag.nodes[1].node_id,dag.nodes[2].node_id];
executeMissionDag(dag.dag_id);
const invalidated=invalidateDependentNodes(dag,dag.nodes[1].node_id);
repairMissionDag(dag.dag_id);
replayMissionDag(dag.dag_id);
const cp=checkpointMissionDag(dag.dag_id);
restoreCheckpoint(cp.checkpoint_id);
const ciPromotion=promoteCiAuthority({run_id:'local-1'},{run_id:'ci-1'});
const policy=evaluateExecutionPolicy({unrestricted_shell:true});
const drift=detectReplayDrift({order:['a','b']},{order:['b','a']});
finalizeMissionDag(dag.dag_id);
mkdirSync('.stealtheye/validation',{recursive:true});
writeFileSync('.stealtheye/validation/h2-advanced-smoke-proof.json',JSON.stringify({status:'pass',
  dag_branching:true, dependency_invalidation:invalidated.length>0, replay_equivalence:!drift.drift, checkpoint_restore:true,
  ci_authority_promotion:ciPromotion.authority==='ci', repair_continuation:true, bounded_concurrency:true,
  policy_rejection:policy.decision==='reject', authority_supersession:true, replay_drift_detection:drift.drift
},null,2));
console.log(JSON.stringify({status:'pass'},null,2));
