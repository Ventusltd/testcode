// Adapted from GridAtlas f417f17 tools/compact-modules.mjs; parser/token/AST checks retained.
/** Build-time token compaction. Executable token text and complete syntax trees must agree. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parserSource=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
assert.equal(typeof parserSource,'string','This build requires Node with its bundled Acorn parser; no regex fallback is allowed');
const parserModule={exports:{}};
new Function('exports','module',parserSource)(parserModule.exports,parserModule);
const acorn=parserModule.exports;
const hash=s=>createHash('sha256').update(s).digest('hex');
export const PARSER=Object.freeze({name:'Acorn bundled in Node',version:acorn.version,node:process.version,sha256:hash(parserSource)});
const syntax=source=>acorn.parse(source,{ecmaVersion:'latest'});
const canonical=ast=>JSON.stringify(ast,(key,value)=>['start','end','loc','range'].includes(key)?undefined:value);
function tokens(source) {
  const list=[];acorn.parse(source,{ecmaVersion:'latest',onToken:list});
  return list.map(token=>source.slice(token.start,token.end));
}
export function proveEquivalent(before,after) {
  assert.deepEqual(tokens(after),tokens(before),'Executable token text changed');
  assert.equal(canonical(syntax(after)),canonical(syntax(before)),'Syntax tree changed (including automatic semicolon insertion)');
}
export function compact(source) {
  const list=[],comments=[];
  acorn.parse(source,{ecmaVersion:'latest',onToken:list,onComment:comments});
  let result='',cursor=0;
  for(const token of list) {
    const gap=source.slice(cursor,token.start);
    result+=(/[\r\n]/.test(gap)?'\n':gap?' ':'')+source.slice(token.start,token.end);
    cursor=token.end;
  }
  // Retain licensing/preservation comments, never treating text inside literals as comments.
  const notices=comments.filter(c=>/@license|@preserve|copyright|SPDX-License-Identifier|permission is hereby granted/i.test(c.value));
  if(notices.length)result=notices.map(c=>source.slice(c.start,c.end)).join('\n')+'\n'+result;
  proveEquivalent(source,result);
  return result;
}

export function replaceMapEngine(source,engine,module) {
  const dockNodes=syntax(source).body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&source.slice(n.start,n.end).includes('gridatlas.measurement-dock.v1'));
  assert(dockNodes.length<=1,'At most one measurement dock module may be carried');
  if(dockNodes.length){const n=dockNodes[0];source=source.slice(0,n.start)+source.slice(n.end);}
  const nodes=syntax(source).body.filter(n=>n.type==="ExpressionStatement"&&n.expression.type==="AssignmentExpression"&&n.expression.left.type==="MemberExpression"&&n.expression.left.object.name==="window"&&n.expression.left.property.name==="initVentusMap");
  assert.equal(nodes.length,1,"Exactly one carried engine assignment required");
  const n=nodes[0]; return source.slice(0,n.start)+module+"\n"+engine+source.slice(n.end);
}

export function replaceOptionalModule(source,module,schema) {
  assert(/^gridatlas\.[a-z0-9-]+\.v\d+$/.test(schema),'Explicit optional module schema required');
  const nodes=syntax(source).body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&source.slice(n.start,n.end).includes(schema));
  assert(nodes.length<=1,'Optional module must not accumulate duplicates');
  if(nodes.length){const n=nodes[0];source=source.slice(0,n.start)+source.slice(n.end);}
  assert(module.includes(schema),'Pinned module must declare its schema');
  syntax(module);
  return source+'\n'+module+'\n';
}
