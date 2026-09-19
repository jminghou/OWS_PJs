// Exercise the actual hook with controlled network latency and failures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost'});
global.window = dom.window; global.document = dom.window.document;
global.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
const documentApi = {autosave:(id,payload)=>new Promise((resolve,reject)=>calls.push({id,payload,resolve,reject}))};
const code = ts.transpileModule(fs.readFileSync('packages/studio/src/hooks/useAutosave.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText;
const exportsObject = {};
new Function('require','exports',code)(name=>name==='../api'?{documentApi}:require(name),exportsObject);
let hook;
function Probe({id=1,title='A',body=''}) {
  hook=exportsObject.useAutosave({documentId:id,title,body,debounceMs:60000,heartbeatMs:60000});
  return null;
}
const root=createRoot(document.getElementById('root'));
async function render(props){await act(async()=>root.render(React.createElement(Probe,props)));}
async function main(){
  await render({title:'A'});
  let first, second;
  await act(async()=>{first=hook.flush();});
  assert.equal(calls.length,1);
  await render({title:'B'});
  let finished=false;
  await act(async()=>{second=hook.flush().then(()=>{finished=true;});});
  assert.equal(finished,false,'Switch must await in-flight save');
  await act(async()=>{calls[0].resolve({saved_at:'now',revision:null});await Promise.resolve();});
  assert.equal(calls.length,2);assert.equal(calls[1].payload.title,'B');
  await act(async()=>{calls[1].resolve({saved_at:'now',revision:null});await Promise.all([first,second]);});
  assert.equal(finished,true);
  await render({title:'C'});
  let failed;
  await act(async()=>{failed=hook.flush().then(()=>false,()=>true);});
  await act(async()=>{calls[2].reject(new Error('offline'));});
  assert.equal(await failed,true,'Explicit flush must reject');
  assert.equal(hook.status,'error');
  let retry;
  await act(async()=>{retry=hook.flush();});
  assert.equal(calls[3].payload.title,'C');
  await act(async()=>{calls[3].resolve({saved_at:'now',revision:null});await retry;});
  // An edit reverted while an earlier save is in flight must still be persisted.
  await render({title:'D'});
  let reverted;
  await act(async()=>{reverted=hook.flush();});
  await render({title:'C'});
  await act(async()=>{calls[4].resolve({saved_at:'now',revision:null});await Promise.resolve();});
  assert.equal(calls[5].payload.title,'C');
  await act(async()=>{calls[5].resolve({saved_at:'now',revision:null});await reverted;});
  await act(async()=>root.unmount());
  console.log('PASS: flush ordering, newest draft, failure propagation/retry, in-flight revert');
}
main().catch(e=>{console.error(e);process.exitCode=1;root.unmount();});
