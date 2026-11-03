// 把 tests/<entry>.ts 连同 assets/scripts 下的代码打成单个 cjs，再用 node 跑。
// 'cc' 通过 esbuild alias 换成假引擎：logicCheck 用精简 cc-stub，
// layoutCheck 要记节点树，用 cc-ui-stub。生产代码不需要为测试做任何改动。
// 用法：node tests/build-check.mjs [logicCheck|layoutCheck]
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const entry = process.argv[2] || 'logicCheck';
// 挂载 View 组件的入口需要完整节点树，纯逻辑入口不需要
const UI_STUB_ENTRIES = new Set(['layoutCheck']);
const stub = UI_STUB_ENTRIES.has(entry) ? 'cc-ui-stub.ts' : 'cc-stub.ts';
const outFile = path.join(testDir, 'out', `${entry}.cjs`);

await build({
  entryPoints: [path.join(testDir, `${entry}.ts`)],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['es2017'],
  alias: { cc: path.join(testDir, stub) },
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [outFile], { stdio: 'inherit' });
process.exit(result.status ?? 1);
