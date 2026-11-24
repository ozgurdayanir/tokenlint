import {classify} from '../engine/compatibility';
import {allowed, ancestry, detect} from '../engine/property-detector';
import {resolve} from '../engine/resolver';
import type {Audit, Row, Settings} from '../shared/model';

import {defaultMode, lookup, metadata} from './variables';

function scanServices() {
  const variables = new Map<string, Promise<Variable|null>>();
  const metadataByVariable = new Map<string, ReturnType<typeof metadata>>();
  const modes = new Map<string, ReturnType<typeof defaultMode>>();
  return {
    variable(id: string) {
      if (!variables.has(id)) variables.set(id, lookup(id));
      return variables.get(id)!;
    },
    metadata(v: Variable) {
      if (!metadataByVariable.has(v.id)) metadataByVariable.set(v.id, metadata(v));
      return metadataByVariable.get(v.id)!;
    },
    mode(id: string) {
      if (!modes.has(id)) modes.set(id, defaultMode(id));
      return modes.get(id)!;
    }
  };
}
export async function inspect(n: SceneNode, s: Settings, services = scanServices()) {
  const chain = ancestry(n);
  const {props, unsupported} = detect(n, s);
  const rows: Row[] = [];
  const path = chain.slice(1).reverse().map(x => x.name).join(' / ');
  const editable = !chain.some(x => 'locked' in x && x.locked);
  for (const p of props) {
    let effective = p.value;
    let variable: Variable|null = null, status: Row['status'] = 'Unverified';
    try {
      variable = p.binding ? await services.variable(p.binding) : null;
      const meta = variable ? await services.metadata(variable) : null;
      const value = variable ? await resolve(variable, n, services.variable, services.mode) : null;
      effective = value ?? p.value;
      status = classify(p, meta, s, value !== null);
    } catch { /* Keep the observation unverified. */
    }
    rows.push({
      ...p,
      value: effective,
      key: [n.id, p.field, p.index ?? ''].join('|'),
      node: n.id,
      name: n.name,
      path,
      status,
      variable: variable?.name,
      editable
    });
  }
  return {rows, unsupported};
}
export async function scan(
    roots: readonly SceneNode[], s: Settings, current: () => boolean,
    progress: (n: number) => void) {
  const stack = [...roots].reverse(), seen = new Set<string>();
  const audit: Audit = {layers: 0, unsupported: 0, rows: []};
  const services = scanServices();
  let last = Date.now();
  while (stack.length) {
    if (!current()) throw Error('Scan cancelled.');
    if (Date.now() - last > 16) {
      progress(audit.layers);
      await new Promise<void>(ok => setTimeout(ok, 0));
      last = Date.now();
    }
    const n = stack.pop()!;
    if (n.removed || seen.has(n.id)) continue;
    seen.add(n.id);
    if (!allowed(ancestry(n), s)) continue;
    audit.layers++;
    const result = await inspect(n, s, services);
    for (const row of result.rows) audit.rows.push(row);
    audit.unsupported += result.unsupported;
    if ('children' in n) {
      const children = n.children;
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
  return audit;
}
