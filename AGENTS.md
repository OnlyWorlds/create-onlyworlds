# Working in this repository

## What this is

`create-onlyworlds`, the command that makes a new folder holding the World Starter (https://github.com/OnlyWorlds/event-starter), a small TypeScript page that reads an OnlyWorlds world. It is one file, `index.mjs`, with no dependencies: it reads the starter's newest release from GitHub, checks every file against the hash the release gives it, and only then writes the folder. What the command does for a user is in `README.md`.

## Set up and run the checks

You need Node.js 22.12 or newer (`engines` in `package.json`) and nothing else: there is nothing to install. Run these from the repository root before you call a change done:

```bash
npm test                                  # node --test: the offline tests in test/create.test.mjs
node index.mjs --help                     # prints the usage text, exit 0
node index.mjs "../scratch/live tool"     # a live copy of the starter's newest release; the folder must be empty or absent
```

`npm test` runs against a fake GitHub and needs no network. It covers what the README promises: the copy and the renaming of `package.json` and `package-lock.json`, `--ref`, a file that fails its hash writes nothing, a path that would leave the folder is refused, a folder that holds anything is refused, and a GitHub token goes to the two API reads and never to a file read.

The live copy reads GitHub's API twice. GitHub allows 60 unsigned reads an hour per network address; with a token in `GITHUB_TOKEN` (or else `GH_TOKEN`) the reads are signed. A 403 or 429 there is the limit, not your change: wait, and run it once more. Write the live copy outside the repository so it is never committed, and delete it afterwards.

CI (`.github/workflows/ci.yml`, job `test`) runs `npm test` and then the live copy on Ubuntu and Windows, each with Node 22.12, 22 and 24, on every push and pull request, and every Monday.

## How a change reaches main

The default branch is `main`. It takes a commit only when the required check `test (ubuntu-latest, 22)` passed on it, and the rule has no bypass, so a direct push is refused, as are a force push and deleting the branch. Every change goes through a pull request: work on a branch (a fork is fine), open the pull request, and wait for the checks. The other five legs of the `test` matrix also run; they are not required, but say in your pull request if one is red. The maintainer reviews and merges; you never merge your own pull request.

Issues and pull requests from anyone are welcome, and the maintainer answers them here.

## Rules a newcomer would break

- No dependencies. The command runs through `npx` straight from this repository, and every file it fetches is checked by hash; a dependency would be code that is not. Use what Node 22.12 ships, and nothing newer than it: CI tests 22.12, the oldest version `package.json` admits.
- Nothing is written until every file has arrived and matched its hash. Keep fetching and checking ahead of the first write.
- A token is sent to `api.github.com` only, never to the host the files come from, and is never printed.
- The command never runs `npm install` and never asks for a key.
- Text files are LF (`.gitattributes`). The shebang line of `index.mjs` must stay LF, or the command fails to start on Linux and macOS.
- The package is not on npm yet, so `README.md` and the usage text in `index.mjs` both give the command as `npx github:OnlyWorlds/create-onlyworlds`. A change to how the command is run changes both.

## What not to change

- Never create or push a tag. A tag starting with `v` runs `.github/workflows/release.yml`, which publishes the package to npm.
- Never edit a file under `.github/workflows/`.
- Never change `version` in `package.json` or a version heading in `CHANGELOG.md` unless the job says so: the release workflow holds the tag, the version and the changelog entry to each other.

## Commit messages

A commit message is public. Its subject is one line of about 100 characters at most, and the rest goes in the body. It says what the change does and why, in plain words, and names no private repository, person or internal ticket.

## Where to stop and ask

Stop, and do not guess, when the job would need a dependency, a change to a file named under "What not to change", a change to what the command does that the job did not name, or a failing check you cannot explain, including one that also fails on `main`. Write one question in your pull request (or in an issue, if there is no pull request yet), push your branch as it stands, and end your turn.

## What a finished pull request says

What changed, and why; each command above you ran, with its last line of output; what you did not run, and why; and anything outside the job that looked wrong and was left alone.
