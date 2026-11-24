import {useState} from 'react';
import {categories,groups,type Collection,type Settings,type Role,type Category} from '../shared/model';
export function Setup({initial,collections,first,save,close}:{initial:Settings;collections:Collection[];first:boolean;save:(s:Settings)=>void;close:()=>void}){
  const [s,set]=useState(initial);
  function change<K extends keyof Settings>(k:K,v:Settings[K]){set({...s,[k]:v});}
  const mappings=s.mappings;
  return <section className="panel"><h2>{first?'Set up TokenLint':'Audit settings'}</h2>
    <p>Choose the collections your team uses for semantic tokens.</p>
    <h3>Variable collections</h3>
    {!collections.length&&<p>No collections available in this file.</p>}
    {collections.map(c=><label className="line" key={c.key}><span>{c.name}<small>{c.library||'Local collection'}</small></span>
      <select value={s.roles[c.key]||'Other'} onChange={e=>change('roles',{...s.roles,[c.key]:e.target.value as Role})}><option>Other</option><option>Semantic</option><option>Primitive</option></select></label>)}
    <h3>Audit properties</h3><div className="checks">{groups.map(g=><label key={g}><input type="checkbox" checked={s.groups.includes(g)} onChange={()=>change('groups',s.groups.includes(g)?s.groups.filter(x=>x!==g):[...s.groups,g])}/>{g}</label>)}</div>
    <h3>Include in scans</h3><div className="checks">{([['hidden','Hidden layers'],['locked','Locked layers (read-only)'],['instances','Instances and descendants'],['controlled','Layout-controlled dimensions']] as const).map(([k,title])=><label key={k}><input type="checkbox" checked={s[k]} onChange={e=>change(k,e.target.checked)}/>{title}</label>)}</div>
    <h3>Semantic path mappings</h3><p>Match a whole path or its descendants. The longest matching prefix wins.</p>
    {mappings.map((m,i)=>{
      const update=(v:Partial<typeof m>)=>change('mappings',mappings.map((x,j)=>j===i?{...x,...v}:x));
      return <div className="mapping" key={i}><input aria-label="Variable path prefix" placeholder="e.g. layout/gap" value={m.prefix} onChange={e=>update({prefix:e.target.value})}/>
        <select aria-label="Semantic category" value={m.category} onChange={e=>update({category:e.target.value as Category})}>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <select aria-label="Mapping collection" value={m.collection} onChange={e=>update({collection:e.target.value})}><option value="">All semantic collections</option>{collections.filter(c=>s.roles[c.key]==='Semantic').map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select>
        <button onClick={()=>change('mappings',mappings.filter((_,j)=>i!==j))}>Remove</button></div>;
    })}
    <button onClick={()=>change('mappings',[...mappings,{prefix:'',category:'Spacing',collection:''}])}>+ Add mapping</button>
    <label className="stack">Icon layer or ancestor name prefix<input placeholder="e.g. Icon/" value={s.iconPrefix} onChange={e=>change('iconPrefix',e.target.value)}/></label>
    <div className="actions"><button className="primary" onClick={()=>save({...s,mappings:mappings.map(m=>({...m,prefix:m.prefix.trim().replace(/\/+$/,'')})).filter(m=>m.prefix)})}>{first?'Finish setup':'Save settings'}</button>{!first&&<button onClick={close}>Cancel</button>}</div>
  </section>;
}
