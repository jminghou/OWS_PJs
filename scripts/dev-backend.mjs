#!/usr/bin/env node
/**
 * 本機後端啟動器 —— 給根目錄 package.json 的 dev:*:api / dev:*:all 使用。
 *
 *   node scripts/dev-backend.mjs <站台> [port]
 *   node scripts/dev-backend.mjs happy-wu
 *   node scripts/dev-backend.mjs polaris 5000
 *
 * 它替你做三件原本要手動做的事：
 *   1. 找到虛擬環境裡的 flask（不必先 Activate）。順序：OWS_VENV 環境變數 → venv → .venv
 *   2. 設 FLASK_SKIP_DOTENV=1。Flask CLI 預設會先載入「當前目錄」的 .env，而站台 config 的
 *      load_dotenv 不 override，於是 repo 根目錄若有 .env，站台自己的 CORS_ORIGINS 等設定
 *      就會被蓋掉（2026-09 Happy_Wu 後台「Failed to fetch」的根因）。站台 .env 由各自的
 *      config.py 載入，不受這個開關影響。
 *   3. 帶上該站的 --app 與 port。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SITES = {
  polaris: { app: 'sites.Polaris_Parent.backend.app:app', port: 5000 },
  claire: { app: 'sites.Claire_Project.backend.app:app', port: 5002 },
  'happy-wu': { app: 'sites.Happy_Wu.backend.app:app', port: 5010 },
};

const [siteKey, portArg] = process.argv.slice(2);
const site = SITES[siteKey];
if (!site) {
  console.error(`用法：node scripts/dev-backend.mjs <${Object.keys(SITES).join('|')}> [port]`);
  process.exit(2);
}
const port = portArg || site.port;

function findFlask() {
  const candidates = [process.env.OWS_VENV, 'venv', '.venv'].filter(Boolean);
  for (const venv of candidates) {
    const base = resolve(ROOT, venv);
    for (const rel of [join('Scripts', 'flask.exe'), join('bin', 'flask')]) {
      const p = join(base, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const flask = findFlask();
if (!flask) {
  console.error(
    '找不到虛擬環境裡的 flask。請先在 repo 根目錄建立並安裝：\n' +
      '  python -m venv venv\n' +
      '  venv\\Scripts\\pip install -r requirements.txt\n' +
      '或用 OWS_VENV 環境變數指定虛擬環境資料夾。',
  );
  process.exit(1);
}

console.log(`[dev-backend] ${siteKey} → http://localhost:${port}  (${flask})`);

const child = spawn(flask, ['--app', site.app, 'run', '--port', String(port)], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, FLASK_SKIP_DOTENV: '1', PYTHONUNBUFFERED: '1' },
});

// Ctrl+C / concurrently 收攤時把 flask 一起帶走，避免留下佔 port 的孤兒程序
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
