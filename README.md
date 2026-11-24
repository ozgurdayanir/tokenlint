# TokenLint

**Keep your design system consistent.**  
Audit, validate, and bind design tokens directly in Figma.

Version 0.1.0 provides selection and page audits, consumer-aware variable previews and single-property manual binding. The plugin runs inside Figma Design. The iframe, application code and CSS are bundled locally.

## Local development

Use Node.js 24 LTS and npm 11. From the directory containing this README, run:

```sh
npm ci
npm run typecheck
npm run build
npm run test
```

The committed lockfile covers production and build dependencies. The test script uses npm exec to fetch pinned Vitest and Vite into npm's tool cache on first use. Registry access is required for that first run. If npm cannot reach the registry or its offline cache lacks Vitest, the default test command reports the fallback and runs the identical suite with Node. Use `npm run test:vitest` to require Vitest. On a disconnected workstation with the build dependencies installed, `npm run test:offline` runs the same cases with Node's test runner. It does not exercise Vitest itself.

1. Open a Figma **Design** file in Figma Desktop.
2. Choose **Plugins → Development → Import plugin from manifest…** and select the root `manifest.json`.
3. Open **Plugins → Development → TokenLint**. Choose semantic and primitive collections and save.
4. To develop, run `npm run dev` and keep it open. It rebuilds main.js and the self-contained ui.html on source changes. Close and rerun TokenLint to load a new build. Reimport the manifest if Figma requests it after a manifest change.

## First audit and manual fix

1. In Settings, assign each relevant collection a role. Multiple collections can be semantic. Unassigned collections remain Other. Settings are stored locally using collection keys.
2. Add semantic path mappings for unrestricted variables. For example, choose Spacing for the prefix `layout/gap` and Radius for `corners`. A mapping matches a complete path segment, case-insensitively. Select a collection to limit the rule. Equally specific conflicting rules produce Unverified.
3. Select a frame, choose **Selection**, then **Scan**. Use **Current page** for the active page and **Cancel scan** to discard a partial scan.
4. Filter issues by property or status. **Locate** selects and zooms to the layer. **Bind variable** or **Replace variable** opens the picker for that property.
5. Search by name, collection, category or displayed value. The initial list uses verified semantic compatibility. Explicitly expanding it reveals other type-compatible semantic variables with warnings. An expanded choice may leave a mismatch or an unverified binding in the audit.
6. Select a variable and review its resolved value. A matching value applies immediately on **Apply variable**. A changed value requires a separate confirmation. Figma Undo can revert the edit.

Opening the picker for an enabled team library imports its matching-type variables using the Figma API so scopes and consumer-resolved previews are available. Auditing alone does not import variables. A library outage leaves local collections usable. Reopen the plugin to rediscover collections.

## Audit rules and implementation decisions

| Observation | Treatment |
| --- | --- |
| Semantic collection, compatible type and role | Valid Semantic Token |
| Eligible raw value | Missing Token |
| Direct binding to an explicitly primitive collection | Primitive Token |
| Semantic binding with clearly incompatible type or category | Mismatched Token |
| Resolved binding from another collection | Other Collection |
| Inaccessible alias or uncertain semantic role | Unverified |

- **Coverage** is valid semantic properties divided by verified eligible properties. Unsupported observations and unverified properties are displayed separately. A dash means there is no denominator. The actionable count includes editable unverified properties.
- **Color** uses each visible solid paint's own binding and index. A frame fill, text fill and stroke have distinct roles. Configure an icon layer/ancestor name prefix to explicitly identify icon fills. Unrecognized shape fills retain an uncertain role. Mixed text paint ranges, style-backed arrays and unsupported paints are counted separately to avoid detaching styles or flattening ranges.
- **Spacing** comes from padding and packed gaps on horizontal/vertical Auto Layout. Wrapped counter-axis gaps must be active. Distributed gaps and grid spacing are outside these fields.
- **Radius** uses Figma's four bindable corner fields. Uniform corners appear as four independent binding targets. Nodes exposing only aggregate or vertex radius are recorded as unsupported.
- **Size** considers applicable width, height and non-null limits. Automatic text sizing, hug, fill, grid-child sizing and stretch/scale constraints are excluded by default. Hidden, locked and instance subtrees are also opt-in. Locked nodes remain read-only.
- **Resolution** tracks alias identity and checks for missing dependencies and cycles in effective modes. Figma resolves the final value for the actual consumer. Audit reads cache variable lookups for that scan only. Applying rechecks the live layer, property, binding, effective value, variable and collection.
- **Mutation** uses setBoundVariable with a Variable object for numbers. For color, setBoundVariableForPaint returns a new paint. Figma requires reassignment of the paint array. Only the target entry is replaced. Binding a color variable can change its alpha as well as its RGB channels.
- **Traversal** uses an iterative stack and visited IDs, yields between batches and never loads every page. The issue list renders in batches. Successful edits rescan the original scope so layout-dependent properties and totals stay current.
- **Runtime boundaries** are in src/plugin (Figma API), src/engine (rules), src/shared (serializable models and messages), and src/ui (React/Tailwind). src/engine/suggestion-engine.ts reserves a type-only interface for future versions.

## Verification and release

See [QA.md](QA.md) for desktop acceptance checks, [PROGRESS.md](PROGRESS.md) for verification status and [CHANGELOG.md](CHANGELOG.md) for scope. Unit and mocked integration tests cannot establish Figma rendering, permissions or undo behavior.

The local repository uses branch `main`. After owner approval, with an authenticated GitHub CLI and the intended owner selected, create the private repository and push:

```sh
gh auth status
gh repo create OWNER/tokenlint --private --source=. --remote=origin --push
```

Replace OWNER with the approved GitHub user or organization. Remote creation and publication are separate from local development.

## API references

- [Variables and consumer resolution](https://developers.figma.com/docs/plugins/api/Variable/)
- [Variable binding API](https://developers.figma.com/docs/plugins/api/figma-variables/)
- [Team library API](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/)
- [Manifest permissions](https://developers.figma.com/docs/plugins/manifest/)
