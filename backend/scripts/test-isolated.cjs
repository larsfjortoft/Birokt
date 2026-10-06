const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, '.cache', 'tests');
fs.mkdirSync(fixture, { recursive: true });
const database = path.join(fixture, 'visits.test.db');
if (!fs.existsSync(database)) fs.writeFileSync(database, '');
const env = { ...process.env, NODE_ENV: 'test', BIROKT_ISOLATED_TESTS: '1', DATABASE_URL: 'file:../.cache/tests/visits.test.db', JWT_SECRET: 'isolated-test-secret-only', ALLOW_LOCAL_AGENT_AUTH: 'false', VISIT_AUDIO_DIR: path.join(fixture, 'audio') };
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['node_modules/prisma/build/index.js', 'generate']);
run(['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate']);
run(['node_modules/jest/bin/jest.js', '--runInBand', ...process.argv.slice(2)]);
