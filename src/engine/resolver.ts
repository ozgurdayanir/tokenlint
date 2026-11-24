import type {Value} from '../shared/model';
// Follow aliases in the consumer's modes to reject broken graphs. Figma owns
// the final evaluation, including inheritance and collection extensions.
export async function resolve(
    variable: Variable, node: SceneNode, lookup: (id: string) => Promise<Variable|null>,
    defaultMode?: (id: string) => Promise<string|undefined>): Promise<Value|null> {
  const seen = new Set<string>();
  let current: Variable|null = variable;
  try {
    while (current) {
      if (seen.has(current.id)) return null;
      seen.add(current.id);
      const mode = node.resolvedVariableModes[current.variableCollectionId] ??
          await defaultMode?.(current.variableCollectionId);
      if (mode === undefined) break;
      const raw = current.valuesByMode[mode];
      if (!raw || typeof raw !== 'object' || !('type' in raw) || raw.type !== 'VARIABLE_ALIAS')
        break;
      current = await lookup(raw.id);
      if (!current) return null;
    }
    const {value} = variable.resolveForConsumer(node);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'r' in value)
      return {r: value.r, g: value.g, b: value.b, a: 'a' in value ? value.a : 1};
  } catch { /* Removed or inaccessible dependency. */
  }
  return null;
}
