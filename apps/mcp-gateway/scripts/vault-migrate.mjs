#!/usr/bin/env node
// ============================================================================
// Xuất / nhập toàn bộ secret của EAA dưới mount 'secret/' (KV v2) của Vault.
//
// Mục đích: chuyển Vault từ dev mode (secret trên RAM) sang server mode
// (file storage) mà KHÔNG phải nhập lại tay cấu hình tích hợp:
//   Bước 1 — trên stack CŨ đang chạy (dev mode):
//              docker compose exec mcp-gateway node scripts/vault-migrate.mjs export
//            → file JSON nằm ở apps/mcp-gateway/backups/ (trên máy host)
//   Bước 2 — docker compose down  (TUYỆT ĐỐI không dùng -v)
//   Bước 3 — docker compose up -d  (vault mới: server mode, tự init + unseal)
//   Bước 4 — nhập ngược:
//              docker compose exec mcp-gateway node scripts/vault-migrate.mjs import <file.json>
//
// Biến môi trường (đã có sẵn trong container mcp-gateway):
//   VAULT_ADDR  (mặc định http://vault:8200)
//   VAULT_TOKEN (mặc định root)
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = (process.env.VAULT_ADDR || 'http://vault:8200').replace(/\/+$/, '');
const TOKEN = process.env.VAULT_TOKEN || 'root';
const MOUNT = 'secret';        // KV v2 mount mà VaultService đang dùng
const ROOT_PATH = 'integrations'; // phạm vi dữ liệu của EAA: integrations/{tenant}/{code}

function die(msg) {
  console.error('LỖI:', msg);
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/v1/${path}`, {
    method,
    headers: { 'X-Vault-Token': TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json().catch(() => null);
}

async function listDir(dir) {
  const r = await api('GET', `${MOUNT}/metadata/${dir}?list=true`);
  return r?.data?.keys || [];
}

// Đệ quy hai cấp là đủ (integrations/{tenant}/{code}) nhưng viết tổng quát
// để dùng được nếu sau này thêm path khác
async function collect(dir, out) {
  for (const key of await listDir(dir)) {
    const p = `${dir}/${key.replace(/\/+$/, '')}`;
    if (key.endsWith('/')) {
      await collect(p, out);
    } else {
      const r = await api('GET', `${MOUNT}/data/${p}`);
      if (r?.data?.data) out[p] = r.data.data;
    }
  }
}

const [cmd, file] = process.argv.slice(2);

if (cmd === 'export') {
  const out = {};
  await collect(ROOT_PATH, out);
  if (Object.keys(out).length === 0) {
    die(`Không tìm thấy secret nào dưới ${MOUNT}/${ROOT_PATH}. Kiểm tra VAULT_ADDR/VAULT_TOKEN?`);
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const dest = file || `/app/backups/vault-export-${stamp}.json`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`Đã export ${Object.keys(out).length} secret → ${dest}`);
  console.log('Hãy kiểm tra nội dung file trước khi chuyển sang vault persistent.');
} else if (cmd === 'import') {
  if (!file) die('Cú pháp: node scripts/vault-migrate.mjs import <file.json>');
  if (!existsSync(file)) die(`Không thấy file ${file}`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const paths = Object.keys(data);
  if (paths.length === 0) die('File rỗng — không có gì để import.');
  for (const p of paths) {
    await api('PUT', `${MOUNT}/data/${p}`, { data: data[p] });
    console.log('Đã import:', p);
  }
  console.log(`Hoàn tất: ${paths.length}/${paths.length} secret.`);
} else {
  console.log('Cú pháp:');
  console.log('  node scripts/vault-migrate.mjs export  [file-đích.json]');
  console.log('  node scripts/vault-migrate.mjs import  <file-nguồn.json>');
  process.exit(cmd ? 1 : 0);
}
