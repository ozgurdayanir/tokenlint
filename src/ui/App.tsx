import {useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {coverage,defaults,groups,statuses,type Audit,type Group,type Row} from '../shared/model';
import type {Event,Command} from '../shared/messages';
import {Setup} from './Settings';
import {Picker,Preview} from './Picker';
import css from './styles.css';
const sheet=document.createElement('style');sheet.textContent=css;document.head.append(sheet);
function send(msg:Command){parent.postMessage({pluginMessage:msg},'*');}
function App(){
  const [setup,setSetup]=useState<Extract<Event,{type:'setup'}>|null>(null),[settings,configure]=useState(false);
  const [scope,setScope]=useState<'page'|'selection'>('selection'),[count,selection]=useState(0),[audit,result]=useState<Audit|null>(null);
  const [busy,working]=useState('Loading collections…'),[notice,say]=useState(''),[progress,scanned]=useState(0);
  const [group,setGroup]=useState<Group|'All'>('All'),[status,filter]=useState('All statuses'),[limit,more]=useState(60);
  const [picker,pick]=useState<Extract<Event,{type:'picker'}>|null>(null),[confirm,review]=useState<Extract<Event,{type:'confirm'}>|null>(null);
  useEffect(()=>{
    function receive(e:MessageEvent<{pluginMessage?:Event}>){
      if(e.source!==parent)return;
      const m=e.data?.pluginMessage;if(!m)return;
      switch(m.type){
        case 'selection':selection(m.count);return;
        case 'progress':scanned(m.layers);return;
        case 'setup':setSetup(m);configure(m.first);result(null);say(m.warning);break;
        case 'audit':result(m.audit);pick(null);review(null);say(m.notice);more(60);break;
        case 'picker':pick(m);review(null);say('');break;
        case 'confirm':review(m);break;
        case 'reset':case 'cancelled':case 'error':result(null);pick(null);review(null);say(m.message);break;
      }
      working('');
    }
    window.addEventListener('message',receive);send({type:'init'});return ()=>window.removeEventListener('message',receive);
  },[]);
  function request(m:Command,label:string){say('');working(label);send(m);}
  const summary=useMemo(()=>audit?coverage(audit):null,[audit]);
  const issues=useMemo(()=>audit?.rows.filter(r=>r.status!=='Valid Semantic Token'&&(group==='All'||r.group===group)&&(status==='All statuses'||status===r.status))??[],[audit,group,status]);
  const layers=new Map<string,Row[]>();
  for(const r of issues.slice(0,limit)){if(!layers.has(r.node))layers.set(r.node,[]);layers.get(r.node)!.push(r);}
  const row=picker&&audit?.rows.find(r=>r.key===picker.key);
  const hasSemantic=setup?.collections.some(c=>setup.settings.roles[c.key]==='Semantic');
  return <><header className="flex items-center justify-between"><div><strong>TokenLint</strong><small className="version">0.1.0</small></div>
    <button disabled={!!busy||!setup} onClick={()=>{pick(null);configure(true);}}>Settings</button></header>
    {notice&&<div role="status" className="notice">{notice}</div>}
    {busy?<div className="panel" role="status"><h2>{busy}</h2>{busy==='Scanning…'&&<><p>{progress} layers scanned</p><button onClick={()=>send({type:'cancel'})}>Cancel scan</button></>}</div>:
    settings&&setup?<Setup first={setup.first} initial={setup.settings} collections={setup.collections} close={()=>configure(false)} save={s=>request({type:'settings',settings:s},'Saving settings…')}/>:
    picker&&row?<Picker row={row} items={picker.candidates} skipped={picker.skipped} confirm={confirm} close={()=>pick(null)} apply={(id,expanded,confirmation)=>request({type:'apply',id,key:row.key,expanded,confirmation},'Checking binding…')}/>:
    <main><section className="panel"><div className="controls"><div className="seg">{(['selection','page'] as const).map(x=><button aria-pressed={scope===x} key={x} onClick={()=>setScope(x)}>{x==='page'?'Current page':'Selection'}</button>)}</div>
    <button className="primary" disabled={scope==='selection'&&!count} onClick={()=>{scanned(0);request({type:'scan',scope},'Scanning…');}}>Scan</button></div>
    <p>{count} selected {count===1?'layer':'layers'}{!count&&scope==='selection'?' · Select a layer to scan.':''}</p>
    {!hasSemantic&&<p className="warning">No semantic collections configured. Choose one in Settings to bind variables.</p>}</section>
    {summary&&audit?<><section className="panel summary"><div className="line"><h2>Token coverage</h2><strong>{summary.percentage===null?'—':Number(summary.percentage.toFixed(1))+'%'}</strong></div>
    <progress aria-label="Token coverage" max={100} value={summary.percentage??0}/><p>{audit.layers} layers · {summary.eligible} eligible properties · {summary.actionable} actionable issues</p>
    <details><summary>Binding breakdown</summary>{statuses.map(s=><div className="line" key={s}>{s}<b>{summary.counts[s]}</b></div>)}<div className="line">Unsupported observations<b>{audit.unsupported}</b></div></details></section>
    <section className="panel"><div className="controls"><h2>Issues</h2><select aria-label="Filter status" value={status} onChange={e=>{filter(e.target.value);more(60);}}>{['All statuses',...statuses.slice(1)].map(s=><option key={s}>{s}</option>)}</select></div>
    <nav aria-label="Property categories">{(['All',...groups] as const).map(g=><button key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);more(60);}}>{g}</button>)}</nav>
    {!issues.length&&<p>{!summary.eligible?'No eligible properties in this scan.':audit.rows.every(r=>r.status==='Valid Semantic Token')?'No issues found.':'No issues match these filters.'}</p>}
    {[...layers].map(([id,rows])=><article key={id}><small>{rows[0].path}</small><div className="line"><h3>{rows[0].name}</h3><button onClick={()=>send({type:'locate',key:rows[0].key})}>Locate</button></div>
    {rows.map(r=><div key={r.key} className="issue"><div><strong>{r.field}{r.index!==undefined?' ['+(r.index+1)+']':''}</strong> <Preview value={r.value}/><small>{r.status}{r.variable?' · '+r.variable:''}</small></div>
    {r.editable&&hasSemantic?<button onClick={()=>request({type:'pick',key:r.key},'Loading semantic variables…')}>{r.binding?'Replace':'Bind'} variable</button>:<small>{!r.editable?'Locked':''}</small>}</div>)}</article>)}
    {issues.length>limit&&<button onClick={()=>more(limit+60)}>Show more ({issues.length-limit})</button>}</section></>:<section className="panel"><h2>Audit design tokens</h2><p>Scan layers to review their variable bindings.</p></section>}</main>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
