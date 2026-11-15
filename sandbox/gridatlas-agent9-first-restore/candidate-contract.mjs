// Static TESTCODE candidate contract + deliberate source mutations.
// This does not execute the map or certify a browser.
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
const path=process.argv[2],manifestPath=process.argv[3];
if(!path||!manifestPath)throw Error('FAIL: candidate AND manifest required');
const bytes=readFileSync(path),src=bytes.toString('utf8'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==manifest.candidate_sha256||digest===manifest.origin_source_sha256)throw Error('FAIL candidate/source hash mismatch');
function check(s){
 const errors=[];
 const must=(yes,name)=>{if(!yes)errors.push(name);};
 must(s.includes("agent9UserChoice = popup.classList.contains('gridatlas-min') ? 'expanded' : 'collapsed'"),'explicit user choice');
 must(s.includes("agent9UserChoice === null ? arriveMinimised : agent9UserChoice === 'collapsed'"),'refresh preserves user choice');
 must(s.includes("agent9UserChoice = null;"),'reset new selection');
 must(s.includes("payload.token !== agent9SelectionToken"),'stale observer');
 must(s.includes("agent9ExpectedToken === agent9SelectionToken"),'stale RAF');
 must(s.includes("agent9MyToken !== agent9SelectionToken"),'stale arrival');
 must(s.includes("button.setAttribute('aria-expanded', String(!collapsed))"),'aria matches class');
 must(s.includes("button.style.minWidth = '44px'"),'44px minimum');
 must(s.includes("button.setAttribute('aria-label', collapsed ? 'Show project measurements'"),'accessible name');
 must(!s.includes("popup.classList.toggle('gridatlas-min');"),'no uncoordinated click toggle');
 must(!s.includes("if (arriveMinimised) popup.classList.add('gridatlas-min');"),'no unguarded reset');
 must(s.includes("if (agent9UserChoice === null) popup.classList.remove('gridatlas-free');"),'preserve chosen drag');
 return errors;
}
const faults=check(src);if(faults.length)throw Error('FAIL static candidate contract '+faults.join(','));
const mutants=[
 ['user-choice-removal',src.replace("agent9UserChoice = popup.classList.contains('gridatlas-min') ? 'expanded' : 'collapsed'","popup.classList.toggle('gridatlas-min')")],
 ['reset-override',src.replace("agent9UserChoice === null ? arriveMinimised : agent9UserChoice === 'collapsed'","arriveMinimised")],
 ['stale-observer',src.replace("payload.token !== agent9SelectionToken","false")],
 ['stale-RAF',src.replace("agent9ExpectedToken === agent9SelectionToken","true")],
 ['aria-removal',src.replace("button.setAttribute('aria-expanded', String(!collapsed))","void collapsed")],
 ['minimum-touch-removal',src.replace("button.style.minWidth = '44px'","void button")],
 ['stale-arrival',src.replace("agent9MyToken !== agent9SelectionToken","false")]
];
for(const [label,bad]of mutants)if(check(bad).length===0)throw Error('FAIL mutation survived: '+label);
console.log('PASS: candidate byte SHA and 11 STATIC checks, '+mutants.length+' source mutants rejected; not real browser proof.');
