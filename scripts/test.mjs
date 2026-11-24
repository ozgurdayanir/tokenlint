import {spawnSync} from 'node:child_process';

// Only fall back when npm cannot acquire the runner. A Vitest test failure
// must always fail the build, including on machines without network access.
const npm = process.env.npm_execpath;
const run = spawnSync(process.execPath, [npm, 'run', 'test:vitest'], {
  encoding:'utf8',
  env:{...process.env, npm_config_fetch_retries:'0', npm_config_fetch_timeout:'10000'}
});
process.stdout.write(run.stdout ?? '');
if(run.status===0) process.exit(0);
if(!/npm error code (?:ENOTCACHED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ETIMEDOUT)\b/.test(run.stderr??'')){
  process.stderr.write(run.stderr || String(run.error||'Vitest failed.'));
  process.exit(run.status??1);
}
console.warn('Vitest unavailable from npm. Running the identical suite with node:test (offline).');
await import('./test-offline.mjs');
