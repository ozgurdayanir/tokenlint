import type {Category,Property,Role,Settings,Status} from '../shared/model';
export type Metadata = {name:string;collection:string;type:string;scopes:readonly string[]};
const scopeCategories: Record<string,Category> = {GAP:'Spacing',CORNER_RADIUS:'Radius',WIDTH_HEIGHT:'Size',TEXT_FILL:'Text Color',FRAME_FILL:'Background Color',STROKE_COLOR:'Border Color'};
export function match(property:Property, variable:Metadata, settings:Settings) {
  const name=variable.name.toLowerCase();
  const matches=settings.mappings.filter(m=>{
    const p=m.prefix.trim().toLowerCase().replace(/\/+$/,'');
    return p && (!m.collection || m.collection===variable.collection) && (name===p || name.startsWith(p+'/'));
  }).sort((a,b)=>b.prefix.length-a.prefix.length);
  let categories:Category[]=[];
  let ambiguous=false;
  if(matches.length) {
    categories=[...new Set(matches.filter(m=>m.prefix.length===matches[0].prefix.length).map(m=>m.category))];
    ambiguous=categories.length!==1 || categories.includes('Other');
  } else {
    categories=variable.scopes.map(s=>scopeCategories[s]).filter(Boolean);
    ambiguous=!variable.scopes.length || variable.scopes.some(s=>['ALL_SCOPES','ALL_FILLS','SHAPE_FILL'].includes(s));
  }
  const typeOK=variable.type===(property.group==='Color'?'COLOR':'FLOAT');
  const compatible=categories.includes(property.category) && (!matches.length || !ambiguous);
  const compatibility=!typeOK?'incompatible':property.category==='Other'?'unknown':compatible?'compatible':ambiguous?'unknown':'incompatible';
  return {compatibility,category:categories.join(' / ') || 'Other'} as const;
}
export function semantic(role:Role|undefined){return role==='Semantic';}
export function classify(property:Property, meta:Metadata|null, settings:Settings, resolved:boolean):Status {
  if(!property.binding) return 'Missing Token';
  if(!meta || !resolved) return 'Unverified';
  const role=settings.roles[meta.collection];
  if(role==='Primitive') return 'Primitive Token';
  if(!semantic(role)) return 'Other Collection';
  const {compatibility}=match(property,meta,settings);
  return compatibility==='compatible'?'Valid Semantic Token':compatibility==='unknown'?'Unverified':'Mismatched Token';
}
