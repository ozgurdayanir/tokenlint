import assert from 'node:assert/strict';

import {confirmation, guard} from '../src/engine/binding';
import {classify, match, semantic} from '../src/engine/compatibility';
import type {Metadata} from '../src/engine/compatibility';
import {allowed, detect} from '../src/engine/property-detector';
import {resolve} from '../src/engine/resolver';
import {scan} from '../src/plugin/scanner';
import {candidates} from '../src/plugin/variables';
import {coverage, defaults, equalValue} from '../src/shared/model';
import type {Property, Row, Settings} from '../src/shared/model';

const settings: Settings = {
  ...defaults,
  roles: {sem: 'Semantic', base: 'Primitive'},
  mappings: [{prefix: 'layout/gap', category: 'Spacing', collection: 'sem'}]
};
const property: Property = {
  field: 'paddingTop',
  category: 'Spacing',
  group: 'Spacing',
  value: 16,
  fingerprint: '16',
  binding: 'alias'
};
const meta: Metadata = {
  name: 'layout/gap/md',
  collection: 'sem',
  type: 'FLOAT',
  scopes: ['ALL_SCOPES']
};
function fixture(values: Record < string, unknown >= {}): SceneNode {
  return {
    type: 'FRAME',
    id: 'frame',
    name: 'Frame',
    visible: true,
    layoutMode: 'HORIZONTAL',
    paddingTop: 16,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    itemSpacing: 4,
    children: [],
    parent: null,
    ...values
  } as unknown as SceneNode;
}
for (const [name, collection, expected] of [
         ['semantic', 'sem', 'Valid Semantic Token'], ['primitive', 'base', 'Primitive Token'],
         ['other', 'arbitrary', 'Other Collection']] as const)
  test(
      name + ' collection classification',
      () => assert.equal(classify(property, {...meta, collection}, settings, true), expected));
test(
    'missing raw binding',
    () => assert.equal(
        classify({...property, binding: undefined}, null, settings, false), 'Missing Token'));
test(
    'unreadable binding',
    () => assert.equal(classify(property, null, settings, false), 'Unverified'));
test(
    'unknown float role stays unverified',
    () => assert.equal(classify(property, {...meta, name: 'n/16'}, settings, true), 'Unverified'));
test(
    'incompatible Figma type',
    () => assert.equal(
        classify(property, {...meta, type: 'COLOR'}, settings, true), 'Mismatched Token'));
test(
    'radius and gap stay distinct at equal values',
    () => assert.equal(
        match(property, {...meta, name: 'r/md', scopes: ['CORNER_RADIUS']}, settings).compatibility,
        'incompatible'));
test(
    'frame fill is incompatible with text',
    () => assert.equal(
        match(
            {...property, group: 'Color', category: 'Text Color'},
            {...meta, name: 'b', type: 'COLOR', scopes: ['FRAME_FILL']}, settings)
            .compatibility,
        'incompatible'));
test(
    'broad fills remain uncertain',
    () => assert.equal(
        match(
            {...property, group: 'Color', category: 'Text Color'},
            {...meta, name: 'b', type: 'COLOR', scopes: ['ALL_FILLS']}, settings)
            .compatibility,
        'unknown'));
test(
    'explicit mapping precedes scopes',
    () => assert.equal(
        match(property, {...meta, scopes: ['CORNER_RADIUS']}, settings).compatibility,
        'compatible'));
test(
    'path segment boundary',
    () => assert.equal(
        match(property, {...meta, name: 'layout/gapped/md'}, settings).compatibility, 'unknown'));
test(
    'conflicting explicit mappings remain uncertain',
    () => assert.equal(
        match(property, meta, {
          ...settings,
          mappings:
              [...settings.mappings, {prefix: 'layout/gap', collection: 'sem', category: 'Radius'}]
        }).compatibility,
        'unknown'));
test(
    'primitive and unconfigured roles excluded',
    () => assert.deepEqual(
        ['Semantic', 'Primitive', 'Other', undefined].map(r => semantic(r as never)),
        [true, false, false, false]));
const fields = (s: SceneNode) => detect(s, settings).props.map(p => p.field);
const flowChildren = [{visible: true}, {visible: true}];
test(
    'four independent padding sides',
    () => assert.equal(fields(fixture()).filter(f => f.startsWith('padding')).length, 4));
test(
    'packed and wrap gaps detected',
    () => assert.ok(
        fields(fixture({children: flowChildren, layoutWrap: 'WRAP', counterAxisSpacing: 12}))
            .includes('counterAxisSpacing') &&
        fields(fixture({children: flowChildren})).includes('itemSpacing')));
test('distributed gaps excluded', () => assert.ok(!fields(fixture({
                                                     children: flowChildren,
                                                     primaryAxisAlignItems: 'SPACE_BETWEEN'
                                                   })).includes('itemSpacing')));
test(
    'no spacing from freeform width',
    () => assert.equal(
        detect(fixture({layoutMode: 'NONE', width: 16}), settings)
            .props.filter(p => p.group === 'Spacing')
            .length,
        0));
test('hug and fill dimensions excluded', () => assert.ok(!fields(fixture({
                                                            layoutSizingHorizontal: 'HUG',
                                                            layoutSizingVertical: 'FILL',
                                                            width: 40,
                                                            height: 30
                                                          })).includes('width')));
test(
    'mixed paints counted outside coverage',
    () => assert.equal(detect(fixture({fills: Symbol('mixed')}), settings).unsupported, 1));
test(
    'independent corners have no duplicate aggregate',
    () => assert.equal(
        detect(fixture({cornerRadius: Symbol(), topLeftRadius: 0, bottomRightRadius: 8}), settings)
            .props.filter(p => p.group === 'Radius')
            .length,
        2));
const solid = {
  type: 'SOLID',
  color: {r: 1, g: 0, b: 0},
  opacity: 0.5,
  blendMode: 'MULTIPLY'
};
test('multiple paints retain original indices and binding identity', () => {
  const r = detect(
      fixture(
          {fills: [solid, {type: 'IMAGE'}, {...solid, boundVariables: {color: {id: 'paint'}}}]}),
      settings);
  assert.deepEqual(
      r.props.filter(p => p.group === 'Color').map(p => [p.index, p.binding]),
      [[0, undefined], [2, 'paint']]);
  assert.equal(r.unsupported, 1);
});
test(
    'style-backed paints excluded from writes',
    () => assert.equal(
        detect(fixture({fills: [solid], fillStyleId: 'S:123'}), settings).unsupported, 1));
test(
    'hidden and locked ancestors excluded',
    () => assert.equal(
        allowed([fixture({locked: true})], settings) ||
            allowed([fixture({visible: false})], settings),
        false));
test('overlapping selection roots deduplicated', async () => {
  const child = fixture({id: 'child'}), parent = fixture({children: [child]});
  const a = await scan([parent, child], settings, () => true, () => {});
  assert.equal(a.layers, 2);
  assert.equal(new Set(a.rows.map(r => r.key)).size, a.rows.length);
});
test(
    'zero verified denominator',
    () => assert.equal(coverage({layers: 0, unsupported: 3, rows: []}).percentage, null));
test('coverage excludes unverified, unsupported and duplicate rows', () => {
  const rows = ['Valid Semantic Token', 'Unverified', 'Missing Token'].map(
      (status, i) => ({...property, status, key: String(i), editable: true} as Row));
  const s = coverage({layers: 1, unsupported: 10, rows: [...rows, rows[0]]});
  assert.equal(s.percentage, 50);
  assert.equal(s.eligible, 3);
  assert.equal(s.actionable, 2);
});
const consumer = fixture({resolvedVariableModes: {s: 'dark', p: 'custom'}});
function variable(id: string, collection: string, values: Record<string, unknown>, value = 24) {
  return {
    id,
    variableCollectionId: collection,
    valuesByMode: values,
    resolveForConsumer: (n: SceneNode) => {
      assert.equal(n, consumer);
      return {value, resolvedType: 'FLOAT'};
    }
  } as unknown as Variable;
}
const alias = (id: string) => ({type: 'VARIABLE_ALIAS', id});
test('recursive cross-collection aliases follow effective consumer modes', async () => {
  const vars = [
    variable('a', 's', {light: 0, dark: alias('b')}), variable('b', 'p', {custom: alias('c')}),
    variable('c', 'p', {custom: 24})
  ];
  const visits: string[] = [];
  const value = await resolve(vars[0], consumer, async id => {
    visits.push(id);
    return vars.find(v => v.id === id) ?? null;
  });
  assert.deepEqual(visits, ['b', 'c']);
  assert.equal(value, 24);
});
test('circular alias yields unverified', async () => {
  const v = variable('a', 's', {dark: alias('a')});
  assert.equal(await resolve(v, consumer, async () => v), null);
});
test(
    'missing alias yields unverified',
    async () => assert.equal(
        await resolve(variable('a', 's', {dark: alias('gone')}), consumer, async () => null),
        null));
test(
    'Figma resolution exception yields unverified',
    async () => assert.equal(
        await resolve(
            {
              ...variable('a', 's', {}),
              resolveForConsumer() {
                throw Error();
              }
            },
            consumer, async () => null),
        null));
test('live guard rejects stale values and bindings', () => {
  for (const changed of [{...property, fingerprint: '24'}, {...property, binding: 'b'}, undefined])
    assert.throws(() => guard(property, changed, meta, settings, false), /changed/);
});
test('expanded picker never permits primitives or wrong data types', () => {
  for (const m of [{...meta, collection: 'base'}, {...meta, type: 'COLOR'}])
    assert.throws(() => guard(property, property, m, settings, true), /eligible/);
});
test(
    'compatible manual binding allowed',
    () => assert.doesNotThrow(() => guard(property, property, meta, settings, false)));
test('uncertain compatibility requires explicit expanded selection', () => assert.throws(
         () => guard(property, property, {...meta, name: 'n'}, settings, false), /compatibility/));
test('confirmation specific to values and variable', () => {
  assert.equal(confirmation('k', 'a', 16, 16, 's'), undefined);
  const proof = confirmation('k', 'a', 16, 24, 's');
  assert.ok(proof);
  assert.notEqual(proof, confirmation('k', 'a', 16, 32, 's'));
  assert.notEqual(proof, confirmation('k', 'b', 16, 24, 's'));
});
test(
    'color comparisons include alpha',
    () => assert.equal(equalValue({r: 1, g: 0, b: 0, a: 1}, {r: 1, g: 0, b: 0, a: 0.5}), false));
test('real picker filtering uses variable collection identity', async () => {
  const vars = ['sem', 'base', 'u'].map(
      k =>
          ({...variable(k, k, {}), name: 'layout/gap/md', resolvedType: 'FLOAT', scopes: ['GAP']}));
  Object.assign(globalThis, {
    figma: {
      variables: {
        getLocalVariablesAsync: async () => vars,
        getVariableCollectionByIdAsync: async (key: string) => ({key})
      }
    }
  });
  assert.deepEqual(
      (await candidates(consumer, property, settings, [])).candidates.map(x => x.id), ['sem']);
});

import {bind} from '../src/plugin/binding-service';
import type {Command} from '../src/shared/messages';
function bindingFixture(color = false) {
  const page = {id: 'page', type: 'PAGE', name: 'Test page', parent: null};
  const n = fixture({
    parent: page,
    resolvedVariableModes: {sem: 'm'},
    fills: [solid, {...solid, blendMode: 'SCREEN'}],
    boundVariables: {}
  });
  const variables = new Map<string, Variable>();
  let undo = 0;
  const host = {
    currentPage: page,
    commitUndo: () => {
      undo++;
    },
    variables: {
      getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
      getVariableCollectionByIdAsync: async (key: string) => ({key, defaultModeId: 'm'}),
      setBoundVariableForPaint: (p: SolidPaint, _field: string, v: Variable) =>
          ({...p, boundVariables: {color: alias(v.id)}})
    }
  };
  Object.assign(globalThis, {figma: host});
  Object.assign(n, {
    setBoundVariable(field: string, v: Variable) {
      Object.assign(n, {boundVariables: {[field]: alias(v.id)}});
    }
  });
  const v = {
    id: 'candidate',
    variableCollectionId: 'sem',
    valuesByMode: {m: 24},
    resolvedType: color ? 'COLOR' : 'FLOAT',
    name: color ? 'surface/brand' : 'layout/gap/md',
    scopes: color ? ['FRAME_FILL'] : ['GAP'],
    resolveForConsumer() {
      return {value: color ? {r: 1, g: 0, b: 0, a: .5} : 24};
    }
  } as unknown as Variable;
  variables.set(v.id, v);
  const p = detect(n, settings).props.find(p => p.field === (color ? 'fills' : 'paddingTop'))!;
  const row = {
    ...p,
    key: 'target',
    node: n.id,
    name: 'Test',
    path: 'Page',
    status: 'Missing Token',
    editable: true
  } as Row;
  const msg: Extract < Command,
      {type: 'apply'} >= {type: 'apply', id: v.id, key: row.key, expanded: false};
  return {row, n, v, msg, host, undo: () => undo};
}
test('numeric change requires a round trip before write and verifies identity', async () => {
  const {row, n, v, msg, undo} = bindingFixture();
  const pending = await bind(row, n, msg, settings, () => {});
  assert.equal(pending?.after, 24);
  assert.equal(undo(), 0);
  assert.deepEqual(n.boundVariables, {});
  assert.equal(
      await bind(row, n, {...msg, confirmation: pending!.confirmation}, settings, () => {}), null);
  assert.equal(n.boundVariables?.paddingTop?.id, v.id);
  assert.equal(undo(), 1);
});
test('stale live property blocks confirmed mutation', async () => {
  const {row, n, msg} = bindingFixture();
  const pending = await bind(row, n, msg, settings, () => {});
  Object.assign(n, {paddingTop: 10});
  await assert.rejects(
      bind(row, n, {...msg, confirmation: pending!.confirmation}, settings, () => {}), /changed/);
  assert.deepEqual(n.boundVariables, {});
});
test('paint binding preserves opacity, blend mode and sibling paint', async () => {
  const {row, n, msg, undo} = bindingFixture(true);
  const frame = n as FrameNode;
  const original = frame.fills as SolidPaint[];
  assert.equal(await bind(row, n, msg, settings, () => {}), null);
  const paints = frame.fills as SolidPaint[];
  assert.equal(paints[0].boundVariables?.color?.id, msg.id);
  assert.equal(paints[0].opacity, .5);
  assert.equal(paints[0].blendMode, 'MULTIPLY');
  assert.equal(paints[1], original[1]);
  assert.equal(undo(), 1);
});
test('silent write failure never returns success', async () => {
  const {row, n, msg, undo} = bindingFixture(true);
  Object.defineProperty(n, 'fills', {get: () => [solid], set: () => {}});
  const p = detect(n, settings).props.find(p => p.field === 'fills')!;
  await assert.rejects(bind({...row, ...p}, n, msg, settings, () => {}), /verified/);
  assert.equal(undo(), 0);
});
test('locked or moved target rejects writes', async () => {
  const {row, n, msg} = bindingFixture();
  Object.assign(n, {locked: true});
  await assert.rejects(bind(row, n, msg, settings, () => {}), /locked/);
  Object.assign(n, {locked: false, parent: null});
  await assert.rejects(bind(row, n, msg, settings, () => {}), /page/);
});
test('default-mode alias cycle is detected when consumer has no override', async () => {
  const v = variable('a', 's', {dark: alias('a')});
  assert.equal(
      await resolve(v, fixture({resolvedVariableModes: {}}), async () => v, async () => 'dark'),
      null);
});

test(
    'inactive single-child gap excluded',
    () => assert.ok(!fields(fixture({
                       children: [{visible: true}, {visible: true, layoutPositioning: 'ABSOLUTE'}]
                     })).includes('itemSpacing')));
