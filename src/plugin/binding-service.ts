import {confirmation, guard} from '../engine/binding';
import {allowed, ancestry, detect} from '../engine/property-detector';
import {resolve} from '../engine/resolver';
import type {Command, Event} from '../shared/messages';
import type {Row, Settings} from '../shared/model';
import {equalValue} from '../shared/model';

import {defaultMode, lookup, metadata} from './variables';

export function readTarget(n: SceneNode, row: Row, settings: Settings) {
  const chain = ancestry(n);
  if (n.removed || !chain.includes(figma.currentPage))
    throw Error('Layer is no longer on the scanned page.');
  if (!allowed(chain, settings) || chain.some(p => 'locked' in p && p.locked))
    throw Error('Layer is locked or excluded.');
  return detect(n, settings).props.find(p => p.field === row.field && p.index === row.index);
}
type Apply = Extract<Command, {type: 'apply'}>;
type Confirmation = Extract<Event, {type: 'confirm'}>;
export async function bind(
    row: Row, n: SceneNode, msg: Apply, settings: Settings,
    checkActive: () => void): Promise<Confirmation|null> {
  const v = await lookup(msg.id);
  if (!v) throw Error('Variable is unavailable.');
  const meta = await metadata(v);
  if (!meta) throw Error('Collection is unavailable.');
  const beforeVariable = row.binding ? await lookup(row.binding) : null;
  const previous = beforeVariable ? await resolve(beforeVariable, n, lookup, defaultMode) : null;
  const value = await resolve(v, n, lookup, defaultMode);
  if (value === null) throw Error('Variable could not be resolved in this mode.');
  checkActive();
  const live = readTarget(n, row, settings);
  guard(row, live, meta, settings, msg.expanded);
  if (!live) throw Error('Property is unavailable.');
  const before = previous ?? live.value;
  if (!equalValue(before, row.value)) throw Error('The effective value changed. Scan again.');
  const proof = confirmation(row.key, v.id, before, value, live.fingerprint);
  if (proof && proof !== msg.confirmation) {
    return {type: 'confirm', key: row.key, id: v.id, before, after: value, confirmation: proof};
  }
  const field = live.field;
  if (field === 'fills' || field === 'strokes') {
    const paints = field === 'fills' && 'fills' in n ? n.fills :
        field === 'strokes' && 'strokes' in n        ? n.strokes :
                                                       null;
    const i = live.index;
    if (!Array.isArray(paints) || i === undefined || paints[i]?.type !== 'SOLID')
      throw Error('Paint is unavailable.');
    const copy: Paint[] = paints.slice();
    copy[i] = figma.variables.setBoundVariableForPaint(paints[i], 'color', v);
    if (field === 'fills' && 'fills' in n)
      n.fills = copy;
    else if (field === 'strokes' && 'strokes' in n)
      n.strokes = copy;
    else
      throw Error('Unsupported paint target.');
  } else
    n.setBoundVariable(field, v);
  if (readTarget(n, row, settings)?.binding !== v.id)
    throw Error('Binding could not be verified. Check the layer and scan again.');
  figma.commitUndo();
  return null;
}
