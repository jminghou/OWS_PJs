#!/usr/bin/env node
/**
 * 啟動前檢查 —— 確認要用的 port 都是空的，否則用白話說明是誰佔的、怎麼處理，並中止啟動。
 *
 *   node scripts/dev-preflight.mjs 5010 3010
 *
 * 為什麼需要：dev:*:all 用 concurrently -k（一個掛掉整組跟著停）。若舊的前端還佔著 port，
 * 新前端會因 EADDRINUSE 失敗，連帶把剛起來的後端也關掉；結果是「舊前端活著、後端不見了」，
 * 瀏覽器登入就顯示 Failed to fetch。那行錯誤混在 log 裡很容易漏看，所以在啟動前先擋下來。
 */

import net from 'node:net';
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).map(Number).filter(Boolean);

function inUse(port) {
  // 前端聽 0.0.0.0 / ::，後端聽 127.0.0.1；兩種位址都試，任何一個連得上就算被佔用
  const tryHost = (host) =>
    new Promise((resolve) => {
      const s = net.connect({ port, host, timeout: 600 });
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('timeout', () => { s.destroy(); resolve(false); });
      s.once('error', () => resolve(false));
    });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((r) => r.some(Boolean));
}

function ownerOf(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, { encoding: 'utf8' });
      const line = out.split(/\r?\n/).find((l) => new RegExp(`:${port}\\s`).test(l));
      return line ? line.trim().split(/\s+/).pop() : null;
    }
    return execSync(`lsof -ti tcp:${port} -s tcp:listen`, { encoding: 'utf8' }).trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

const busy = [];
for (const port of ports) {
  if (await inUse(port)) busy.push({ port, pid: ownerOf(port) });
}

if (busy.length === 0) process.exit(0);

console.error('\n✖ 無法啟動：以下 port 已經被佔用（通常是上一次開的終端機還沒關）\n');
for (const { port, pid } of busy) {
  console.error(`    port ${port}  ←  PID ${pid ?? '未知'}`);
}
console.error('\n  處理方式（擇一）：');
console.error('    1. 找到還開著的舊終端機，按 Ctrl+C 關掉它，再重跑這個指令。');
if (process.platform === 'win32') {
  for (const { pid } of busy) if (pid) console.error(`    2. 或直接結束該程序：  taskkill /PID ${pid} /T /F`);
} else {
  for (const { pid } of busy) if (pid) console.error(`    2. 或直接結束該程序：  kill ${pid}`);
}
console.error('');
process.exit(1);
