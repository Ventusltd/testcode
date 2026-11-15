// OLD SOURCE diagnostic, not browser acceptance.
import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
if(!process.argv[2])throw Error('FAIL: explicit source required');
const b=readFileSync(process.argv[2]);
const sha=createHash('sha256').update(b).digest('hex');
const expected='7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca';
if(sha!==expected)throw Error('FAIL: source SHA drift '+sha);
const src=b.toString('utf8');
const tests=[
 ['restore toggle',src.includes("popup.classList.toggle('gridatlas-min')")],
 ['reset re-minimises',src.includes("if (arriveMinimised) popup.classList.add('gridatlas-min')")],
 ['late injection invokes reset',/function injectIntoCard[\s\S]{0,300}resetCardGeometry\(content, links.length\)/.test(src)]
];
writeFileSync('agent9-original-source.json',JSON.stringify({sourceSha256:sha,
 type:'ORIGINAL VULNERABLE SOURCE SIGNATURE; NOT BROWSER PASS',checks:tests},null,2)+'\n');
for(const [n,ok]of tests)if(!ok)throw Error('FAIL old source signature '+n);
console.log('PASS: pinned original source signature 3/3; NOT product repair.');
