import { runH4AutonomousResume } from '../lib/h4-autonomous-resume.js';

const out = runH4AutonomousResume(process.cwd());
console.log(JSON.stringify(out, null, 2));
