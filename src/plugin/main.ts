import type {Command,Event} from '../shared/messages';
import {defaults,type Audit,type Collection,type Row,type Settings} from '../shared/model';
import {allowed,ancestry,detect} from '../engine/property-detector';
import {guard,confirmation} from '../engine/binding';
import {resolve} from '../engine/resolver';
import {candidates,discover,lookup,metadata} from './variables';
import {scan} from './scanner';

figma.showUI(__html__,{width:440,height:640,themeColors:true});
const post=(e:Event)=>figma.ui.postMessage(e);
let settings:Settings=defaults, collections:Collection[]=[];
let audit:Audit|null=null, roots:readonly SceneNode[]=[];
let epoch=0, busy=false;
const selection=()=>post({type:'selection',count:figma.currentPage.selection.length});
figma.on('selectionchange',selection);
figma.on('currentpagechange',()=>{
  epoch++;busy=false;audit=null;roots=[];
  post({type:'reset',message:'Page changed. Start a new scan.'});selection();
});
async function refresh(ticket:number,notice=''){
  const result=await scan(roots,settings,()=>ticket===epoch,n=>post({type:'progress',layers:n}));
  if(ticket!==epoch)return;
  audit=result;post({type:'audit',audit,notice});
}
function active(ticket:number){
  if(ticket!==epoch) throw Error('Request expired.');
}
async function target(row:Row){
  const n=await figma.getNodeByIdAsync(row.node);
  if(!n || !('visible' in n) || !ancestry(n).includes(figma.currentPage)) throw Error('Layer moved or was removed. Scan again.');
  return n;
}
function read(n:SceneNode,row:Row){
  const chain=ancestry(n);
  if(!allowed(chain,settings)||chain.some(p=>'locked' in p && p.locked)) throw Error('Layer is locked or excluded.');
  return detect(n,settings).props.find(p=>p.field===row.field && p.index===row.index);
}
async function apply(row:Row,n:SceneNode,msg:Extract<Command,{type:'apply'}>,ticket:number){
  const v=await lookup(msg.id);
  if(!v) throw Error('Variable is unavailable.');
  const meta=await metadata(v);
  if(!meta) throw Error('Collection is unavailable.');
  const value=await resolve(v,n,lookup);
  if(value===null) throw Error('Variable could not be resolved in this mode.');
  active(ticket);
  const live=read(n,row);
  guard(row,live,meta,settings,msg.expanded);
  if(!live) throw Error('Property is unavailable.');
  const proof=confirmation(row.key,v.id,live.value,value,live.fingerprint);
  if(proof && proof!==msg.confirmation){
    post({type:'confirm',key:row.key,id:v.id,before:live.value,after:value,confirmation:proof});return;
  }
  const field=live.field;
  if(field==='fills'||field==='strokes'){
    const paints=field==='fills'&&'fills' in n?n.fills:field==='strokes'&&'strokes' in n?n.strokes:null;
    const i=live.index;
    if(!Array.isArray(paints)||i===undefined||paints[i]?.type!=='SOLID') throw Error('Paint is unavailable.');
    const copy:Paint[]=paints.slice();
    copy[i]=figma.variables.setBoundVariableForPaint(paints[i],'color',v);
    if(field==='fills'&&'fills' in n)n.fills=copy;
    else if(field==='strokes'&&'strokes' in n)n.strokes=copy;
    else throw Error('Unsupported paint target.');
  }else n.setBoundVariable(field,v);
  // Invalidate the prior snapshot as soon as a write has occurred.
  audit=null;
  if(read(n,row)?.binding!==v.id) throw Error('Binding could not be verified. Check the layer and scan again.');
  figma.commitUndo();
  await refresh(ticket,'Applied '+v.name+' to '+row.name+'.');
}
figma.ui.onmessage=async (msg:Command)=>{
  if(msg.type==='cancel'){
    epoch++;busy=false;audit=null;post({type:'cancelled',message:'Scan cancelled. Start a new scan when ready.'});return;
  }
  if(busy)return;
  busy=true;
  const ticket=++epoch;
  try{
    if(msg.type==='init'||msg.type==='settings'){
      if(msg.type==='settings'){
        await figma.clientStorage.setAsync('tokenlint.settings.v1',msg.settings);
        settings=msg.settings;audit=null;
      }
      const saved=await figma.clientStorage.getAsync('tokenlint.settings.v1') as Settings|undefined;
      const data=await discover();active(ticket);
      settings={...defaults,...saved};collections=data.collections;
      post({type:'setup',...data,settings,first:!saved});selection();return;
    }
    if(msg.type==='scan'){
      roots=msg.scope==='page'?figma.currentPage.children:figma.currentPage.selection;
      audit=null;
      if(msg.scope==='selection' && !roots.length)throw Error('Select at least one layer to scan.');
      await refresh(ticket);return;
    }
    const row=audit?.rows.find(r=>r.key===msg.key);
    if(!row) throw Error('Scan again to refresh the layer and property.');
    const n=await target(row);active(ticket);
    if(msg.type==='locate'){
      figma.currentPage.selection=[n];figma.viewport.scrollAndZoomIntoView([n]);return;
    }
    if(msg.type==='pick'){
      const live=read(n,row);
      if(!live||live.fingerprint!==row.fingerprint||live.binding!==row.binding)throw Error('Property changed. Scan again.');
      const result=await candidates(n,live,settings,collections);active(ticket);
      post({type:'picker',key:row.key,...result});return;
    }
    await apply(row,n,msg,ticket);
  }catch(e){
    if(ticket===epoch)post({type:'error',message:e instanceof Error?e.message:String(e)});
  }finally{if(ticket===epoch)busy=false;}
};
