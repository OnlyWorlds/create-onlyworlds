#!/usr/bin/env node
// create-onlyworlds: one command makes a working page that reads an OnlyWorlds world. Until the package is
// on npm it runs from the repository: `npx github:OnlyWorlds/create-onlyworlds my-tool`.
//
// It copies the World Starter (github.com/OnlyWorlds/event-starter) at its newest tagged release into a new
// folder, names the project after the folder, and prints the next three commands. It holds no copy of the
// starter, so the two cannot drift; it never runs npm install and never asks for a key. No dependencies:
// it reads the release's file list from GitHub's API and each file from its raw host, and checks every file
// against the git hash the release's tree gives for it before writing.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const STARTER = 'OnlyWorlds/event-starter';
const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8')).version;
const HEADERS = { 'User-Agent': `create-onlyworlds/${VERSION}`, Accept: 'application/vnd.github+json' };
const USAGE = `Usage: npx github:OnlyWorlds/create-onlyworlds [folder] [--ref <tag>]

Makes <folder> (default: onlyworlds-tool) holding the World Starter, a small page that reads an
OnlyWorlds world, at its newest release, or at <tag> with --ref.`;

export class CreateError extends Error {}

/** The npm package name a folder name gives: lowercase, letters, digits, '-', '.', '_'; never empty. */
export function packageName(folder) {
  const name = basename(resolve(folder)).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+/, '').replace(/-+$/, '');
  return name.slice(0, 214) || 'onlyworlds-tool';
}

/** A tree path as a file inside `root`, or a refusal: no absolute path, no '..', nothing outside. */
export function placeIn(root, path) {
  if (typeof path !== 'string' || path === '' || isAbsolute(path) || path.includes('\\') || path.split('/').some((s) => s === '' || s === '.' || s === '..')) {
    throw new CreateError(`the starter's file list holds a path this tool will not write: ${JSON.stringify(path)}`);
  }
  const out = resolve(root, ...path.split('/'));
  const rel = relative(resolve(root), out);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new CreateError(`a path outside the folder: ${path}`);
  return out;
}

/** git's blob hash of some bytes: what the tree names each file by. */
export function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function parseArgs(argv) {
  let folder, ref;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--ref') {
      ref = argv[++i];
      if (!ref || ref.startsWith('-')) throw new CreateError('--ref needs a tag, for example --ref v0.2.0');
    } else if (a.startsWith('-')) throw new CreateError(`unknown option ${a} (only --ref and --help)`);
    else if (folder === undefined) folder = a;
    else throw new CreateError(`one folder only; also got ${a}`);
  }
  return { folder: folder ?? 'onlyworlds-tool', ref };
}

async function getJson(fetchFn, url) {
  const res = await fetchFn(url, { headers: HEADERS });
  if (res.status === 403 || res.status === 429) {
    throw new CreateError(`GitHub refused the request (${res.status}): its API allows 60 requests an hour without signing in. Try again later.`);
  }
  if (!res.ok) throw new CreateError(`GitHub answered ${res.status} for ${url}`);
  return res.json();
}

/**
 * Copy the starter into `folder`. Returns { dir, name, ref, files }. `fetchFn` is the global fetch unless a
 * test gives another; `log` prints progress.
 */
export async function create({ folder, ref, fetchFn = globalThis.fetch, log = () => {} }) {
  const dir = resolve(folder);
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new CreateError(`${dir} exists and is not empty`);
  const tag = ref ?? (await getJson(fetchFn, `https://api.github.com/repos/${STARTER}/releases/latest`)).tag_name;
  if (typeof tag !== 'string' || tag === '') throw new CreateError('the starter has no release to copy');
  log(`Copying the World Starter ${tag} into ${dir}`);
  const tree = await getJson(fetchFn, `https://api.github.com/repos/${STARTER}/git/trees/${encodeURIComponent(tag)}?recursive=1`);
  if (tree.truncated) throw new CreateError("GitHub cut the starter's file list short; nothing was written");
  const blobs = (tree.tree ?? []).filter((e) => e.type === 'blob' && e.mode !== '120000');
  if (blobs.length === 0) throw new CreateError(`the starter at ${tag} has no files`);
  const files = [];
  for (const e of blobs) {
    const target = placeIn(dir, e.path);
    const url = `https://raw.githubusercontent.com/${STARTER}/${encodeURIComponent(tag)}/${e.path.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetchFn(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
    if (!res.ok) throw new CreateError(`GitHub answered ${res.status} for ${e.path}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (gitBlobSha(bytes) !== e.sha) throw new CreateError(`${e.path} did not arrive as the release holds it`);
    files.push([target, bytes]);
  }
  // Everything has arrived and checked out before the first byte is written.
  const name = packageName(folder);
  for (const [target, bytes] of files) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  rename(join(dir, 'package.json'), name, (doc) => doc);
  rename(join(dir, 'package-lock.json'), name, (doc) => {
    if (doc.packages?.['']) doc.packages[''] = { ...doc.packages[''], name, version: '0.1.0' };
    return doc;
  });
  return { dir, name, ref: tag, files: files.length };
}

function rename(path, name, more) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const doc = more({ ...JSON.parse(text), name, version: '0.1.0' });
  writeFileSync(path, JSON.stringify(doc, null, 2) + (text.endsWith('\n') ? '\n' : ''));
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`create-onlyworlds: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) return console.log(USAGE);
  try {
    const r = await create({ ...args, log: (line) => console.log(line) });
    const cd = relative(process.cwd(), r.dir) || '.';
    console.log(`\n${r.files} files, the World Starter ${r.ref}, named ${r.name}.\n\nNext:\n  cd ${cd.includes(' ') ? JSON.stringify(cd) : cd}\n  npm install\n  npm run dev\n\nThe page reads Moppetopia, the public demo world, with no account. README.md says how to read your own.`);
  } catch (e) {
    console.error(`create-onlyworlds: ${e instanceof CreateError ? e.message : e.stack ?? e}`);
    process.exit(1);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
