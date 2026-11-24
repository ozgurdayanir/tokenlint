import {allowed,ancestry,detect} from '../engine/property-detector';
import {classify} from '../engine/compatibility';
import {resolve} from '../engine/resolver';
import type {Audit,Row,Settings} from '../shared/model';
import {lookup,metadata} from './variables';
export async function inspect(n:SceneNode,s:Settings){
  const chain=ancestry(n);
  const {props,unsupported}=detect(n,s);
  const rows:Row[]=[];
  for(const p of props){
    let variable:Variable|null=null, status:Row['status']='Unverified';
    try{
      variable=p.binding?await lookup(p.binding):null;
      const meta=variable?await metadata(variable):null;
      const value=variable?await resolve(variable,n,lookup):null;
      status=classify(p,meta,s,value!==null);
    }catch{ /* Keep the observation unverified. */ }
    rows.push({...p,key:[n.id,p.field,p.index??''].join('|'),node:n.id,name:n.name,path:chain.slice(1).reverse().map(x=>x.name).join(' / '),status,variable:variable?.name,editable:!chain.some(x=>'locked' in x && x.locked)});
  }
  return {rows,unsupported};
}
export async function scan(roots:readonly SceneNode[],s:Settings,current:()=>boolean,progress:(n:number)=>void){
  const stack=[...roots].reverse(), seen=new Set<string>();
  const audit:Audit={layers:0,unsupported:0,rows:[]};
  let last=Date.now();
  while(stack.length){
    if(!current()) throw Error('Scan cancelled.');
    if(Date.now()-last>16){
      progress(audit.layers);
      await new Promise<void>(ok=>setTimeout(ok,0));last=Date.now();
    }
    const n=stack.pop()!;
    if(n.removed || seen.has(n.id)) continue;
    seen.add(n.id);
    if(!allowed(ancestry(n),s)) continue;
    audit.layers++;
    const result=await inspect(n,s);
    for(const row of result.rows) audit.rows.push(row);
    audit.unsupported+=result.unsupported;
    if('children' in n) for(let i=n.children.length-1;i>=0;i--) stack.push(n.children[i]);
  }
  return audit;
}
