import {type Candidate, equalValue, type Property, type Settings, type Value} from '../shared/model';

import {match, type Metadata, semantic} from './compatibility';

export function guard(
    original: Property, live: Property|undefined, meta: Metadata, s: Settings, expanded: boolean) {
  if (!live || original.fingerprint !== live.fingerprint || original.binding !== live.binding ||
      original.category !== live.category)
    throw Error('This property changed. Scan again before binding.');
  if (!semantic(s.roles[meta.collection]) ||
      meta.type !== (live.group === 'Color' ? 'COLOR' : 'FLOAT'))
    throw Error('Variable is no longer eligible.');
  if (!expanded && match(live, meta, s).compatibility !== 'compatible')
    throw Error('Review semantic compatibility first.');
}
export function confirmation(
    key: string, id: Candidate['id'], before: Value, after: Value, stamp: string) {
  return equalValue(before, after) ? undefined : JSON.stringify([key, id, before, after, stamp]);
}
