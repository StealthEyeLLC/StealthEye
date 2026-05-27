import { mkdirSync, writeFileSync } from 'node:fs';
import { h2Bootstrap, writeH2State, createMissionDag, executeMissionDag, repairMissionDag, replayMissionDag, checkpointMissionDag, restoreCheckpoint, finalizeMissionDag } from '../lib/h2.js';

h2Bootstrap(); writeH2State();
const dag=createMissionDag({mission_id:'h2:smoke',nodes:[{name:'start'},{name:'finish'}]});
dag.nodes[1].dependencies=[dag.nodes[0].node_id];
executeMissionDag(dag.dag_id);
repairMissionDag(dag.dag_id);
replayMissionDag(dag.dag_id);
const cp=checkpointMissionDag(dag.dag_id);
restoreCheckpoint(cp.checkpoint_id);
finalizeMissionDag(dag.dag_id);
mkdirSync('.stealtheye/validation',{recursive:true});
writeFileSync('.stealtheye/validation/h2-smoke-proof.json',JSON.stringify({status:'pass',dag_id:dag.dag_id,checkpoint_id:cp.checkpoint_id},null,2));
console.log(JSON.stringify({status:'pass'},null,2));
