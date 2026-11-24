import type {Category, Field, Group, Property, Settings} from '../shared/model';
const corners =
    ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const;
const dimensions = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const;
const shapes =
    new Set(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'LINE', 'BOOLEAN_OPERATION']);
const frames = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET']);
export function ancestry(node: BaseNode) {
  const chain: BaseNode[] = [];
  for (let p: BaseNode|null = node; p && p.type !== 'DOCUMENT'; p = p.parent) chain.push(p);
  return chain;
}
export function allowed(chain: BaseNode[], s: Settings) {
  return !chain.some(
      p => ('visible' in p && !p.visible && !s.hidden) ||
          ('locked' in p && p.locked && !s.locked) || (p.type === 'INSTANCE' && !s.instances));
}
function fixedAxis(n: SceneNode, horizontal: boolean) {
  if (n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION' || n.type === 'LINE' && !horizontal)
    return false;
  if ('layoutSizingHorizontal' in n &&
      (horizontal ? n.layoutSizingHorizontal : n.layoutSizingVertical) !== 'FIXED')
    return false;
  if (n.type === 'TEXT' &&
      (n.textAutoResize === 'WIDTH_AND_HEIGHT' || (!horizontal && n.textAutoResize === 'HEIGHT')))
    return false;
  if (n.parent && 'layoutMode' in n.parent && n.parent.layoutMode === 'GRID' &&
      'layoutPositioning' in n && n.layoutPositioning !== 'ABSOLUTE')
    return false;
  if ('constraints' in n) {
    const axis = horizontal ? n.constraints.horizontal : n.constraints.vertical;
    if (axis === 'STRETCH' || axis === 'SCALE') return false;
  }
  return true;
}
export function detect(n: SceneNode, s: Settings) {
  const props: Property[] = [];
  let unsupported = 0;
  function numeric(field: Exclude<Field, 'fills'|'strokes'>, group: Exclude<Group, 'Color'>) {
    if (!(field in n)) return;
    const value: unknown = Reflect.get(n, field);
    if (value == null) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      unsupported++;
      return;
    }
    props.push({
      field,
      category: group,
      group,
      value,
      binding: n.boundVariables?.[field]?.id,
      fingerprint: String(value)
    });
  }
  if (s.groups.includes('Color'))
    for (const field of ['fills', 'strokes'] as const) {
      if (!(field in n)) continue;
      if (field === 'strokes' && 'strokeWeight' in n && n.strokeWeight === 0) continue;
      const paints = field === 'fills' && 'fills' in n ? n.fills :
          field === 'strokes' && 'strokes' in n        ? n.strokes :
                                                         null;
      if (!Array.isArray(paints)) {
        unsupported++;
        continue;
      }
      const styled = field === 'fills' ? 'fillStyleId' in n && n.fillStyleId :
                                         'strokeStyleId' in n && n.strokeStyleId;
      const icon = s.iconPrefix.trim().toLowerCase();
      const isIcon =
          icon && ancestry(n).some(a => a.type !== 'PAGE' && a.name.toLowerCase().startsWith(icon));
      const category: Category = field === 'strokes' ? 'Border Color' :
          n.type === 'TEXT'                          ? 'Text Color' :
          isIcon                                     ? 'Icon Color' :
          frames.has(n.type)                         ? 'Background Color' :
                                                       'Other';
      paints.forEach((paint: Paint, index: number) => {
        if (paint.visible === false) return;
        if (styled || paint.type !== 'SOLID') {
          unsupported++;
          return;
        }
        const value = {...paint.color, a: paint.opacity ?? 1};
        props.push({
          field,
          index,
          category,
          group: 'Color',
          value,
          binding: paint.boundVariables?.color?.id,
          fingerprint: JSON.stringify([paints.length, paint])
        });
      });
    }
  if (s.groups.includes('Spacing') && 'layoutMode' in n &&
      (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL')) {
    for (const f of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const)
      numeric(f, 'Spacing');
    let participating = 0;
    for (const child of n.children) {
      if (child.visible &&
          (!('layoutPositioning' in child) || child.layoutPositioning !== 'ABSOLUTE'))
        participating++;
      if (participating >= 2) break;
    }
    if (participating >= 2 && n.primaryAxisAlignItems !== 'SPACE_BETWEEN')
      numeric('itemSpacing', 'Spacing');
    if (participating >= 2 && n.layoutWrap === 'WRAP' &&
        n.counterAxisAlignContent !== 'SPACE_BETWEEN')
      numeric('counterAxisSpacing', 'Spacing');
  }
  if (s.groups.includes('Radius')) {
    for (const f of corners) numeric(f, 'Radius');
    if ('cornerRadius' in n && !(corners[0] in n)) unsupported++;
  }
  if (s.groups.includes('Size') &&
      (frames.has(n.type) || shapes.has(n.type) || n.type === 'TEXT' ||
       (s.controlled && n.type === 'GROUP'))) {
    for (const f of dimensions) {
      if (f === 'width' || f === 'height') {
        if (!s.controlled && !fixedAxis(n, f === 'width')) continue;
      } else if (
          !('layoutMode' in n && n.layoutMode !== 'NONE') &&
          !(n.parent && 'layoutMode' in n.parent && n.parent.layoutMode !== 'NONE'))
        continue;
      numeric(f, 'Size');
    }
  }
  return {props, unsupported};
}
