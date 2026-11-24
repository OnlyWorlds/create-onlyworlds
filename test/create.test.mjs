// Offline: the copy on a fake GitHub, every refusal before a byte is written. node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create, CreateError, gitBlobSha, packageName, placeIn, shownPath, STARTER } from '../index.mjs';

const FILES = {
  'package.json': '{\n  "name": "onlyworlds-event-starter",\n  "private": true,\n  "version": "0.2.0"\n}\n',
  'package-lock.json': '{\n  "name": "onlyworlds-event-starter",\n  "version": "0.2.0",\n  "packages": {\n    "": {\n      "name": "onlyworlds-event-starter",\n      "version": "0.2.0"\n    }\n  }\n}\n',
  'src/main.ts': 'console.log("hi");\n',
};

function fakeGitHub({ files = FILES, tag = 'v9.9.9', tree = undefined, body = {}, status = {} } = {}) {
  const calls = [];
  const sent = [];
  const entries = tree ?? Object.entries(files).map(([path, text]) => ({ path, type: 'blob', mode: '100644', sha: gitBlobSha(Buffer.from(text)) }));
  const fetchFn = async (url, init = {}) => {
    calls.push(url);
    sent.push({ url, headers: init.headers ?? {} });
    const json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (status[url]) return { ok: false, status: status[url] };
    if (url === `https://api.github.com/repos/${STARTER}/releases/latest`) return json({ tag_name: tag });
    if (url.startsWith(`https://api.github.com/repos/${STARTER}/git/trees/`)) return json({ tree: entries, truncated: false, ...body });
    const prefix = `https://raw.githubusercontent.com/${STARTER}/${tag}/`;
    if (url.startsWith(prefix)) {
      const path = url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
      if (!(path in files)) return { ok: false, status: 404 };
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(files[path]).buffer };
    }
    return { ok: false, status: 404 };
  };
  return { fetchFn, calls, sent };
}

// A fresh folder in the system temp folder, removed when the test that made it ends.
const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'create-onlyworlds-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
// The tests read no token from the shell they run in: a test that wants one passes its own env.
const make = (o) => create({ env: {}, ...o });

test('copies the newest release, names the project after its folder, in package.json and the lock', async (t) => {
  const folder = join(scratch(t), 'My Tool');
  const { fetchFn } = fakeGitHub();
  const r = await make({ folder, fetchFn });
  assert.deepEqual([r.name, r.ref, r.files], ['my-tool', 'v9.9.9', 3]);
  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  assert.deepEqual([pkg.name, pkg.version, pkg.private], ['my-tool', '0.1.0', true]);
  const lock = JSON.parse(readFileSync(join(folder, 'package-lock.json'), 'utf8'));
  assert.deepEqual([lock.name, lock.packages[''].name, lock.packages[''].version], ['my-tool', 'my-tool', '0.1.0']);
  assert.equal(readFileSync(join(folder, 'src', 'main.ts'), 'utf8'), FILES['src/main.ts']);
});

test('--ref copies that tag and never asks for the newest', async (t) => {
  const folder = join(scratch(t), 't');
  const { fetchFn, calls } = fakeGitHub({ tag: 'v0.1.0' });
  await make({ folder, ref: 'v0.1.0', fetchFn });
  assert.ok(!calls.some((u) => u.endsWith('/releases/latest')));
});

test('a file that does not match the release writes nothing at all', async (t) => {
  const folder = join(scratch(t), 't');
  const files = { ...FILES };
  const { fetchFn } = fakeGitHub({ files: { ...files, 'src/main.ts': 'tampered\n' }, tree: Object.entries(files).map(([path, text]) => ({ path, type: 'blob', mode: '100644', sha: gitBlobSha(Buffer.from(text)) })) });
  await assert.rejects(make({ folder, fetchFn }), (e) => e instanceof CreateError && /did not arrive as the release holds it/.test(e.message));
  assert.equal(existsSync(folder), false);
});

test('a path that would leave the folder is refused before anything is written', async (t) => {
  for (const path of ['../evil.txt', '/abs.txt', 'a/../../b', 'a//b', 'a\\b', './x']) {
    const folder = join(scratch(t), 't');
    const { fetchFn } = fakeGitHub({ files: { [path]: 'x' } });
    await assert.rejects(make({ folder, fetchFn }), CreateError, path);
    assert.equal(existsSync(folder), false, path);
  }
});

test('a folder that holds anything is refused', async (t) => {
  const folder = join(scratch(t), 't');
  mkdirSync(folder);
  writeFileSync(join(folder, 'keep.txt'), 'mine');
  const { fetchFn, calls } = fakeGitHub();
  await assert.rejects(make({ folder, fetchFn }), /exists and is not empty/);
  assert.deepEqual(readdirSync(folder), ['keep.txt']);
  assert.equal(calls.length, 0);
});

test('a cut-short file list, an empty one, a refused API and a missing file all refuse', async (t) => {
  await assert.rejects(make({ folder: join(scratch(t), 't'), fetchFn: fakeGitHub({ body: { truncated: true } }).fetchFn }), /cut the starter's file list short/);
  await assert.rejects(make({ folder: join(scratch(t), 't'), fetchFn: fakeGitHub({ tree: [] }).fetchFn }), /has no files/);
  const latest = `https://api.github.com/repos/${STARTER}/releases/latest`;
  await assert.rejects(make({ folder: join(scratch(t), 't'), fetchFn: fakeGitHub({ status: { [latest]: 403 } }).fetchFn }), /60 requests an hour/);
  const tree = [{ path: 'gone.txt', type: 'blob', mode: '100644', sha: 'x' }];
  await assert.rejects(make({ folder: join(scratch(t), 't'), fetchFn: fakeGitHub({ tree }).fetchFn }), /404 for gone.txt/);
});

test('a symlink and a submodule in the tree are left out', async (t) => {
  const folder = join(scratch(t), 't');
  const tree = [
    { path: 'src/main.ts', type: 'blob', mode: '100644', sha: gitBlobSha(Buffer.from(FILES['src/main.ts'])) },
    { path: 'link', type: 'blob', mode: '120000', sha: 'whatever' },
    { path: 'sub', type: 'commit', mode: '160000', sha: 'whatever' },
  ];
  const r = await make({ folder, fetchFn: fakeGitHub({ tree }).fetchFn });
  assert.equal(r.files, 1);
  assert.deepEqual(readdirSync(folder), ['src']);
});

test('a token in GITHUB_TOKEN, else GH_TOKEN, goes to both API reads and to no file read; with neither, nothing is signed', async (t) => {
  const api = (s) => s.filter((c) => c.url.startsWith('https://api.github.com/'));
  const raw = (s) => s.filter((c) => c.url.startsWith('https://raw.githubusercontent.com/'));
  for (const [env, want] of [[{ GITHUB_TOKEN: 'tok-a', GH_TOKEN: 'tok-b' }, 'Bearer tok-a'], [{ GH_TOKEN: 'tok-b' }, 'Bearer tok-b'], [{ GITHUB_TOKEN: '', GH_TOKEN: 'tok-b' }, 'Bearer tok-b']]) {
    const { fetchFn, sent } = fakeGitHub();
    await create({ folder: join(scratch(t), 't'), fetchFn, env });
    assert.equal(api(sent).length, 2);
    assert.deepEqual(api(sent).map((c) => c.headers.Authorization), [want, want]);
    assert.equal(raw(sent).length, 3);
    assert.ok(raw(sent).every((c) => !('Authorization' in c.headers)), 'a file read carried the token');
  }
  for (const env of [{}, { GITHUB_TOKEN: '' }]) {
    const { fetchFn, sent } = fakeGitHub();
    await create({ folder: join(scratch(t), 't'), fetchFn, env });
    assert.equal(sent.length, 5);
    assert.ok(sent.every((c) => !('Authorization' in c.headers)), 'a request was signed with no token set');
  }
});

test('a refused token is named by its variable; a refusal with a token does not blame the unsigned limit', async (t) => {
  const latest = `https://api.github.com/repos/${STARTER}/releases/latest`;
  const folder = join(scratch(t), 't');
  await assert.rejects(create({ folder, fetchFn: fakeGitHub({ status: { [latest]: 401 } }).fetchFn, env: { GH_TOKEN: 'tok-b' } }),
    (e) => e instanceof CreateError && /refused the token in GH_TOKEN \(401\)/.test(e.message) && !e.message.includes('tok-b'));
  await assert.rejects(create({ folder, fetchFn: fakeGitHub({ status: { [latest]: 403 } }).fetchFn, env: { GITHUB_TOKEN: 'tok-a' } }),
    (e) => e instanceof CreateError && /\(403\), sent with the token in GITHUB_TOKEN/.test(e.message) && !/60 requests/.test(e.message) && !e.message.includes('tok-a'));
  await assert.rejects(create({ folder, fetchFn: fakeGitHub({ status: { [latest]: 401 } }).fetchFn, env: {} }), /GitHub answered 401/);
  assert.ok(!existsSync(folder));
});

test('names and places', (t) => {
  assert.equal(packageName('My Tool'), 'my-tool');
  assert.equal(packageName('_x__'), 'x__');
  assert.equal(packageName('---'), 'onlyworlds-tool');
  assert.equal(packageName('Tëst'), 't-st');
  assert.throws(() => placeIn('/r', ''), CreateError);
  assert.match(placeIn(scratch(t), 'a/b.txt'), /a[\\/]b\.txt$/);
  // git's own hash of "hello\n"
  assert.equal(gitBlobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('the next-step cd line gives a path with a space between double quotes, as it is', () => {
  assert.equal(shownPath('my-tool'), 'my-tool');
  assert.equal(shownPath('..\\live\\no-space'), '..\\live\\no-space');
  // A Windows path keeps single backslashes, so the printed line is the command to type.
  assert.equal(shownPath('..\\live\\live tool'), '"..\\live\\live tool"');
  assert.equal(shownPath('../live/live tool'), '"../live/live tool"');
  // A path that itself holds a double quote is escaped as before.
  assert.equal(shownPath('say "hi" there'), JSON.stringify('say "hi" there'));
});
