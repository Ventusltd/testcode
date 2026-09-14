import test from 'node:test';import assert from 'node:assert/strict';
import {validateFindings} from './controller.mjs';
const sources=[{path:'fixture.mjs',lines:['const value = input.count;']}];
const valid={findings:[{path:'fixture.mjs',line:1,quote:'input.count',kind:'bug',reason:'Missing input throws.',suggested_test:'Pass an undefined input.'}]};
test('accepts a source-grounded advisory',()=>assert.equal(validateFindings(valid,sources),valid));
test('rejects invented source evidence',()=>{const r=structuredClone(valid);r.findings[0].quote='input.other';assert.throws(()=>validateFindings(r,sources),/exactly/);});
test('rejects unprovided files and expanded scope',()=>{const r=structuredClone(valid);r.findings[0].path='secret';assert.throws(()=>validateFindings(r,sources),/Unsupported/);});
test('rejects excessive findings',()=>assert.throws(()=>validateFindings({findings:Array(6).fill(valid.findings[0])},sources),/five/));
test('derives a line only from a unique exact quote',()=>{const r=structuredClone(valid);delete r.findings[0].line;assert.equal(validateFindings(r,sources).findings[0].line,1);});
test('rejects an ambiguous exact quote',()=>{const r=structuredClone(valid);delete r.findings[0].line;assert.throws(()=>validateFindings(r,[{path:'fixture.mjs',lines:[...sources[0].lines,...sources[0].lines]}]),/Unsupported/);});

test('rejects a quoted line outside the supplied excerpt',()=>{const r=structuredClone(valid);assert.throws(()=>validateFindings(r,[{path:'fixture.mjs',lines:['const value = input.count;','const second = 2;'],start:2,end:2}]),/Unsupported/);});
