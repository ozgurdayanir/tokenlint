export const categories = [
  'Spacing', 'Radius', 'Size', 'Text Color', 'Background Color', 'Border Color', 'Icon Color',
  'Other'
] as const;
export type Category = typeof categories[number];
export const groups = ['Color', 'Spacing', 'Radius', 'Size'] as const;
export type Group = typeof groups[number];
export type Role = 'Semantic'|'Primitive'|'Other';
export type Settings = {
  roles: Record<string, Role>; mappings: {prefix: string; category: Category; collection: string}[];
  iconPrefix: string;
  groups: Group[];
  hidden: boolean;
  locked: boolean;
  instances: boolean;
  controlled: boolean;
};
export const defaults: Settings = {
  roles: {},
  iconPrefix: '',
  mappings: [],
  groups: [...groups],
  hidden: false,
  locked: false,
  instances: false,
  controlled: false
};
export type Collection = {
  key: string; name: string;
  library?: string
};
export type Value = number|{
  r: number;
  g: number;
  b: number;
  a: number
};
export const statuses = [
  'Valid Semantic Token', 'Missing Token', 'Primitive Token', 'Mismatched Token',
  'Other Collection', 'Unverified'
] as const;
export type Status = typeof statuses[number];
export type Field = 'fills'|'strokes'|'paddingTop'|'paddingRight'|'paddingBottom'|'paddingLeft'|
    'itemSpacing'|'counterAxisSpacing'|'topLeftRadius'|'topRightRadius'|'bottomLeftRadius'|
    'bottomRightRadius'|'width'|'height'|'minWidth'|'minHeight'|'maxWidth'|'maxHeight';
export type Property = {
  field: Field;
  index?: number; category: Category; group: Group; value: Value;
  binding?: string; fingerprint: string
};
export type Row = Property&{
  key: string;
  node: string;
  name: string;
  path: string;
  status: Status;
  variable?: string;
  editable: boolean
};
export type Audit = {
  layers: number; unsupported: number; rows: Row[]
};
export type Candidate = {
  id: string; name: string; collection: string; category: string;
  compatibility: 'compatible' | 'unknown' | 'incompatible';
  value: Value
};
export function formatValue(v: Value) {
  if (typeof v === 'number') return Number(v.toFixed(4)) + ' px';
  return '#' +
      [v.r, v.g, v.b, ...(v.a === 1 ? [] : [v.a])]
          .map(c => Math.round(c * 255).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
}
export function equalValue(a: Value, b: Value) {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return (['r', 'g', 'b', 'a'] as const).every(k => Math.abs(a[k] - b[k]) < 1e-7);
}
export function coverage(audit: Audit) {
  const counts = Object.fromEntries(statuses.map(s => [s, 0])) as Record<Status, number>;
  const seen = new Set<string>();
  let actionable = 0;
  for (const row of audit.rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    counts[row.status]++;
    if (row.editable && row.status !== 'Valid Semantic Token') actionable++;
  }
  const verified = seen.size - counts.Unverified;
  return {
    counts,
    eligible: seen.size,
    actionable,
    percentage: verified ? 100 * counts['Valid Semantic Token'] / verified : null
  };
}
