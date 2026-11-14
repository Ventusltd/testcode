#!/usr/bin/env node
import {reviewContext} from './independent-evidence.mjs';
// Independently challenge the generated JS against all 50 adversarial mutants.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {fixture,CLOCK} from './fixture.mjs';
import {versionNames} from './versions.mjs';
const file=process.argv[2];if(!file)throw Error('bundle path required');
const {manifest,evaluate}=await import(pathToFileURL(resolve(file)).href);
if(manifest.release_authorised!==false||manifest.synthetic_only!==true)
 throw Error('generated bundle claims publication authority');
if(evaluate(fixture(),reviewContext()).passed!==true)
 throw Error('valid fixture rejected by distilled single-file bundle');
let rejected=0;
for(const id of versionNames){
 const {mutate}=await import('./versions/'+id+'.mjs');
 if(evaluate(mutate(fixture()),reviewContext()).passed!==false)
   throw Error('distilled bundle accepted adversarial mutation '+id);
 rejected++;
}
console.log('Distilled single-file master rejects '+rejected+'/'+versionNames.length+' independent adversarial changes; no publish permission');
