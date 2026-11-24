import { build, context } from 'esbuild';
import { compile } from 'tailwindcss';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const watch = process.argv.includes('--watch');
await mkdir('dist', { recursive: true });
const options = { bundle: true, format: 'iife', target: 'es2017', minify: !watch, logLevel: 'info' };
const main = { ...options, entryPoints: ['src/plugin/main.ts'], outfile: 'dist/main.js' };
const ui = { ...options, tsconfig: 'tsconfig.ui.json', entryPoints: ['src/ui/App.tsx'], write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'inline-ui', setup(builder) {
    builder.onLoad({filter: /styles\.css$/}, async ({path}) => {
      const sheet = await compile(await readFile(path, 'utf8'));
      return {contents: sheet.build(['flex','items-center','justify-between','flex-wrap','min-w-0','truncate','w-full']), loader:'text', watchFiles:[path]};
    });
    builder.onEnd(async result => {
      if(result.errors.length) return;
      const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
      await writeFile('dist/ui.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TokenLint</title><div id="root"></div><script>'+js+'</script></html>');
    });
  }}] };
if (watch) {
  for (const config of [main,ui]) await (await context(config)).watch();
} else await Promise.all([build(main),build(ui)]);
