const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const BASE = 'http://127.0.0.1:4299';
let server;

function http(path, opts = {}) {
  return fetch(BASE + path, opts);
}

test.before(async () => {
  server = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '4299', JWT_SECRET: 'test_jwt_secret_value_32_chars_minimum!!' },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1000));
});

test.after(() => {
  if (server) server.kill('SIGTERM');
});

test('health endpoint', async () => {
  const res = await http('/api/health');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
});

test('login works with seeded admin account', async () => {
  const res = await http('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '79991112233', password: 'Adm!n-FullHub-2026' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.token);
  assert.equal(json.user.role, 'admin');
});
