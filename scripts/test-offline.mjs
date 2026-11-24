// Execute the same test definitions with the built-in runner on offline machines.
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'tokenlint-tests-'));
try{
  const output=await build({entryPoints:['tests/tokenlint.test.ts'],bundle:true,platform:'node',format:'esm',write:false,banner:{js:"import {test} from 'node:test';"}});
  const file=join(dir,'tokenlint.test.mjs');
  await writeFile(file,output.outputFiles[0].text);
  process.exitCode=spawnSync(process.execPath,['--test',file],{stdio:'inherit'}).status??1;
}finally{await rm(dir,{recursive:true,force:true});}
