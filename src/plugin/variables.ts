import {match, semantic} from '../engine/compatibility';
import {resolve} from '../engine/resolver';
import type {Candidate, Collection, Property, Settings} from '../shared/model';
export const lookup = (id: string) => figma.variables.getVariableByIdAsync(id);
export async function defaultMode(id: string) {
  return (await figma.variables.getVariableCollectionByIdAsync(id))?.defaultModeId;
}
export async function discover() {
  const collections: Collection[] = (await figma.variables.getLocalVariableCollectionsAsync())
                                        .map(c => ({key: c.key, name: c.name}));
  let warning = '';
  try {
    const available = figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    let timer: ReturnType<typeof setTimeout>|undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Library discovery timed out.')), 4000);
    });
    const libraries = await Promise.race([available, timeout]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
    for (const c of libraries) {
      if (!collections.some(x => x.key === c.key))
        collections.push({key: c.key, name: c.name, library: c.libraryName});
    }
  } catch {
    warning = 'Team libraries are unavailable. Local collections are ready.';
  }
  return {collections, warning};
}
export async function metadata(v: Variable) {
  const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
  return c ? {name: v.name, collection: c.key, type: v.resolvedType, scopes: v.scopes} : null;
}
export async function candidates(
    n: SceneNode, p: Property, s: Settings, collections: Collection[]) {
  const type = p.group === 'Color' ? 'COLOR' : 'FLOAT';
  const items: Candidate[] = [];
  const seen = new Set<string>();
  const collectionKeys = new Map<string, string>();
  let skipped = 0;
  async function add(v: Variable) {
    if (seen.has(v.id) || v.resolvedType !== type) return;
    seen.add(v.id);
    let key = collectionKeys.get(v.variableCollectionId);
    if (!key) {
      key = (await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId))?.key;
      if (!key) return;
      collectionKeys.set(v.variableCollectionId, key);
    }
    if (!semantic(s.roles[key])) return;
    const meta = {name: v.name, collection: key, type: v.resolvedType, scopes: v.scopes};
    const value = await resolve(v, n, lookup, defaultMode);
    if (value === null) {
      skipped++;
      return;
    }
    const c = collections.find(x => x.key === meta.collection);
    items.push({
      id: v.id,
      name: v.name,
      collection: c ? (c.library ? c.library + ' / ' : '') + c.name : meta.collection,
      value,
      ...match(p, meta, s)
    });
  }
  for (const v of await figma.variables.getLocalVariablesAsync(type)) {
    try {
      await add(v);
    } catch {
      skipped++;
    }
  }
  for (const c of collections.filter(c => c.library && semantic(s.roles[c.key]))) {
    try {
      const list = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key);
      for (const item of list.filter(i => i.resolvedType === type)) {
        try {
          await add(await figma.variables.importVariableByKeyAsync(item.key));
        } catch {
          skipped++;
        }
      }
    } catch {
      skipped++;
    }
  }
  return {candidates: items, skipped};
}
