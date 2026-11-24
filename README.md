# TokenLint

**Keep your design system consistent.**  
Audit, validate, and bind design tokens directly in Figma.

TokenLint checks colors, Auto Layout spacing, corner radii, and sizes. Use it to find a raw value, see which layer uses it, and bind a semantic variable from your design system.

## Install in Figma Desktop

With Git and Node.js 24 LTS installed, build the plugin once:

```sh
git clone https://github.com/ozgurdayanir/tokenlint.git
cd tokenlint
npm ci
npm run build
```

Open a Figma Design file in the desktop app. Choose **Plugins → Development → Import plugin from manifest…** and select `manifest.json` from the cloned folder. Launch **Plugins → Development → TokenLint**.

## Run your first audit

1. **Choose your collections.** Mark collections containing tokens you apply to layers as **Semantic**. Mark collections containing base values as **Primitive**. Leave the rest as **Other**, then click **Finish setup**. You can change these choices in **Settings**.
2. **Scan a frame.** Select a frame on the canvas, choose **Selection**, and click **Scan**. To audit the whole page, choose **Current page**.
3. **Find a property.** Filter the results by category or status. Click **Locate** to select and zoom to the affected layer.
4. **Bind a variable.** Click **Bind variable** or **Replace variable**. Choose a semantic variable and review its value in the layer’s current mode. Click **Apply variable**. If this changes the design value, TokenLint asks you to confirm and then refreshes the audit.

For example, if a frame has **16 px** of raw top padding, binding a spacing token that resolves to **16 px** keeps the padding as it is. Choosing a **24 px** token shows the change before you confirm.

## If a token is missing from the picker

Check that its collection is marked **Semantic**. If your variables use broad Figma scopes, open **Settings → Semantic path mappings** and map a path such as `layout/gap` to **Spacing**. This makes a token like `layout/gap/small` eligible for padding. Primitive collections stay out of the picker.

## Development

Run `npm run dev` to rebuild on edits, then reopen TokenLint in Figma to try the changes. Run `npm run typecheck` and `npm test` to check the project. The test command reports when it uses the offline Node runner. Use `npm run test:vitest` to require Vitest.

See the [Figma Desktop QA checklist](QA.md) for manual verification.
