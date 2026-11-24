import {ancestry} from '../engine/property-detector';
import type {Command, Event} from '../shared/messages';
import {type Audit, type Collection, defaults, type Row, type Settings} from '../shared/model';

import {bind, readTarget} from './binding-service';
import {scan} from './scanner';
import {candidates, discover} from './variables';

figma.showUI(__html__, {width: 440, height: 640, themeColors: true});
const post = (e: Event) => figma.ui.postMessage(e);
let settings: Settings = defaults, collections: Collection[] = [];
let audit: Audit|null = null, roots: readonly SceneNode[] = [];
let epoch = 0, busy = false;
const selection = () => post({type: 'selection', count: figma.currentPage.selection.length});
figma.on('selectionchange', selection);
figma.on('currentpagechange', () => {
  epoch++;
  busy = false;
  audit = null;
  roots = [];
  post({type: 'reset', message: 'Page changed. Start a new scan.'});
  selection();
});
async function refresh(ticket: number, notice = '') {
  const result =
      await scan(roots, settings, () => ticket === epoch, n => post({type: 'progress', layers: n}));
  if (ticket !== epoch) return;
  audit = result;
  post({type: 'audit', audit, notice});
}
function active(ticket: number) {
  if (ticket !== epoch) throw Error('Request expired.');
}
async function target(row: Row) {
  const n = await figma.getNodeByIdAsync(row.node);
  if (!n || !('visible' in n) || !ancestry(n).includes(figma.currentPage))
    throw Error('Layer moved or was removed. Scan again.');
  return n;
}
figma.ui.onmessage = async (msg: Command) => {
  if (msg.type === 'cancel') {
    epoch++;
    busy = false;
    audit = null;
    post({type: 'cancelled', message: 'Scan cancelled. Start a new scan when ready.'});
    return;
  }
  if (busy) return;
  busy = true;
  const ticket = ++epoch;
  try {
    if (msg.type === 'init' || msg.type === 'settings') {
      if (msg.type === 'settings') {
        await figma.clientStorage.setAsync('tokenlint.settings.v1', msg.settings);
        settings = msg.settings;
        audit = null;
      }
      const saved =
          await figma.clientStorage.getAsync('tokenlint.settings.v1') as Settings | undefined;
      const data = await discover();
      active(ticket);
      settings = {...defaults, ...saved};
      collections = data.collections;
      post({type: 'setup', ...data, settings, first: !saved});
      selection();
      return;
    }
    if (msg.type === 'scan') {
      figma.skipInvisibleInstanceChildren = !settings.hidden;
      roots = msg.scope === 'page' ? figma.currentPage.children : figma.currentPage.selection;
      audit = null;
      if (msg.scope === 'selection' && !roots.length)
        throw Error('Select at least one layer to scan.');
      await refresh(ticket);
      return;
    }
    const row = audit?.rows.find(r => r.key === msg.key);
    if (!row) throw Error('Scan again to refresh the layer and property.');
    const n = await target(row);
    active(ticket);
    if (msg.type === 'locate') {
      figma.currentPage.selection = [n];
      figma.viewport.scrollAndZoomIntoView([n]);
      post({type: 'located'});
      return;
    }
    if (msg.type === 'pick') {
      const live = readTarget(n, row, settings);
      if (!live || live.fingerprint !== row.fingerprint || live.binding !== row.binding)
        throw Error('Property changed. Scan again.');
      const result = await candidates(n, live, settings, collections);
      active(ticket);
      post({type: 'picker', key: row.key, ...result});
      return;
    }
    const pending = await bind(row, n, msg, settings, () => active(ticket));
    if (pending) {
      post(pending);
      return;
    }
    audit = null;
    await refresh(ticket, 'Binding applied to ' + row.name + '.');
  } catch (e) {
    if (ticket === epoch)
      post({type: 'error', message: e instanceof Error ? e.message : String(e)});
  } finally {
    if (ticket === epoch) busy = false;
  }
};
