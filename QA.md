# TokenLint 0.1.0 · Figma Desktop QA

Use a disposable design file. Keep all fixture documents, screenshots, real collection keys and customer data outside the repository.

| Check | Steps | Expected result |
| --- | --- | --- |
| Import and startup | Build, import manifest.json, open TokenLint | Themed 440 × 640 UI and collection onboarding |
| Role persistence | Create three arbitrarily named collections. Mark one Semantic, one Primitive, leave one Other. Close and reopen | Roles persist by key |
| Mapping | Give 16 px spacing, radius, size and font variables unrestricted scopes. Configure distinct path prefixes | Only spacing appears by default on padding. Broad variables need explicit expansion |
| Paint roles | Give text, background and border tokens identical RGBA; map each path | Text picker shows text candidates and strokes show border candidates |
| Library access | Enable a published library and configure it as semantic. Try another as primitive. Repeat offline | Accessible semantic variables resolve. Primitive picker entries stay absent. Local-only auditing works offline |
| Traversal | Scan an empty selection, then a nested Auto Layout frame, then the page | Empty selection is explained. Scanned layers and properties are distinct and deduplicated |
| Layout | Compare freeform, packed, distributed and wrapped frames. Include a HUG text layer and FILL child | Padding and gaps appear only where applicable. Managed sizes follow the setting |
| Corners | Use equal radii with different bindings, then independent radii | Four distinct targets preserve side-specific identities |
| Colors | Use multiple solid paints with opacity and blend mode, a gradient, linked style and mixed text fills | Bind one solid entry. Other entries, styles and unrelated paint fields survive |
| Effective modes | Create semantic aliases pointing into a second collection; set different inherited and explicit consumer modes | Preview follows that layer for both alias levels; identity remains the semantic variable |
| Statuses | Include raw, primitive, other, incompatible, unrestricted and valid bindings | All six states match the README. Unverified and unsupported observations do not lower coverage |
| Preserve value | Apply a semantic 16 px variable to 16 px padding | Binding verified, issue removed, totals refreshed, no value-change prompt |
| Change value | Apply 24 px to 16 px, dismiss, repeat and confirm | Before/after shown; only confirmation mutates the property. Figma Undo restores the prior binding/value |
| Stale target | Open picker, then edit the property, reorder paints, switch modes, lock, delete or move the layer before applying | Re-read blocks stale/ineligible edits or requests fresh confirmation. No false success |
| Layers | Include hidden ancestors, locked nodes and nested instances with preferences off/on | Excluded subtrees stay excluded. Locked rows have no write action. Instance overrides are intentional |
| Navigation | Locate an issue inside nested frames | Selection, zoom, breadcrumb and exact property agree |
| Scale | Scan a large page, cancel, change pages, rescan; filter and load more issues | Responsive progress. Cancelled or old-page results never replace the latest scan |
| UI states | Try no collections, no search hits, no compatible variables, no issues, no eligible properties, light/dark themes | Clear empty states, readable controls and no division errors |
