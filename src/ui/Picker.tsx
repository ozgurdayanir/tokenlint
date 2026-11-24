import { useState } from 'react';
import { formatValue, type Candidate, type Row, type Value } from '../shared/model';
import type { Event } from '../shared/messages';
export function Preview({ value }: {
    value: Value;
}) {
    const formatted = formatValue(value);
    return <span className="value">{typeof value !== 'number' && <i style={{ backgroundColor: formatted }}/>}{formatted}</span>;
}
export function Picker({ row, items, skipped, apply, confirm, close }: {
    row: Row;
    items: Candidate[];
    skipped: number;
    apply: (id: string, expanded: boolean, proof?: string) => void;
    confirm: Extract<Event, {
        type: 'confirm';
    }> | null;
    close: () => void;
}) {
    const [query, search] = useState(''), [collection, filter] = useState(''), [expanded, expand] = useState(false), [id, select] = useState('');
    const eligible = items.filter(x => expanded || x.compatibility === 'compatible');
    const filtered = eligible.filter(x => (!collection || collection === x.collection) && [x.name, x.category, x.collection, formatValue(x.value)].join(' ').toLowerCase().includes(query.toLowerCase()));
    const selected = filtered.find(x => x.id === id);
    const groups = new Map<string, Candidate[]>();
    for (const x of filtered) {
        const k = x.collection + ' · ' + x.category;
        if (!groups.has(k))
            groups.set(k, []);
        groups.get(k)!.push(x);
    }
    const review = confirm && selected?.id === confirm.id ? confirm : null;
    return <section className="panel">
    <button onClick={close}>← Audit</button>
    <h2>Bind variable</h2>
    <p>{row.path} / {row.name}</p>
    <div className="line">
    <strong>{row.field}{row.index !== undefined ? ' [' + (row.index + 1) + ']' : ''}</strong>
    <Preview value={row.value}/>
    </div>
    <div className="controls">
    <input className="w-full" autoFocus type="search" placeholder="Search name, path or value" aria-label="Search variables" value={query} onChange={e => search(e.target.value)}/>
    <select aria-label="Filter collection" value={collection} onChange={e => filter(e.target.value)}>
    <option value="">All collections</option>{[...new Set(items.map(x => x.collection))].map(c => <option key={c}>{c}</option>)}</select>
    </div>
    <label>
    <input type="checkbox" checked={expanded} onChange={e => expand(e.target.checked)}/> Show other type-compatible variables</label>
    {expanded && <p className="warning">Expanded results can bind a different semantic role.</p>}
    {skipped > 0 && <p>{skipped} unavailable variables or libraries skipped.</p>}
    <div className="options">{[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([g, list]) => <section key={g}>
        <h3>{g}</h3>
      {list.sort((a, b) => a.name.localeCompare(b.name)).map(x => <button key={x.id} aria-pressed={x.id === id} className="line choice" onClick={() => select(x.id)}>
            <span>{x.name}{x.id === row.binding ? ' · Current' : ''}{x.compatibility !== 'compatible' && <small>{x.compatibility === 'unknown' ? 'Unverified category' : 'Different category'}</small>}</span>
            <Preview value={x.value}/>
            </button>)}</section>)}</div>
    {!filtered.length && <p>{eligible.length ? 'No search results.' : 'No compatible variables found. Review collection and category settings.'}</p>}
    {selected && <div className="apply">
        <strong>{selected.name}</strong>
        <div className="comparison">
        <Preview value={review?.before ?? row.value}/> → <Preview value={review?.after ?? selected.value}/>
        </div>
      {review && <p className="warning">Applying this variable changes the current value. Confirm to continue.</p>}
      <button className="primary" onClick={() => apply(id, expanded, review?.confirmation)}>{review ? 'Confirm value change' : 'Apply variable'}</button>
        </div>}
  </section>;
}
