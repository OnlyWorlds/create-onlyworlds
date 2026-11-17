# create-onlyworlds

Start a tool on an [OnlyWorlds](https://www.onlyworlds.com) world with one command:

```bash
npx github:OnlyWorlds/create-onlyworlds my-tool
cd my-tool
npm install
npm run dev
```

`create-onlyworlds` is not published on npm yet, so the command runs it from this repository. Until this note is gone, `npm create onlyworlds` does not run this code.

Open http://localhost:5173. The page already reads a real world, Moppetopia, the public demo world, with no account. It lists the world's elements one type at a time and opens one element's fields and links. From there the first hour goes to your idea.

## What it makes

The folder holds the [World Starter](https://github.com/OnlyWorlds/event-starter) at its newest release: plain TypeScript with Vite and the [OnlyWorlds SDK](https://www.npmjs.com/package/@onlyworlds/sdk), no framework. The starter's README says how to read your own world with a read key, and its `AGENTS.md` is written for an AI working in the folder with you.

`create-onlyworlds` copies the starter's files from GitHub and names the project after the folder. It never runs `npm install` for you and never asks for a key. Each file is checked against the hash the release gives it before anything is written. If the folder already holds anything, nothing happens.

```
npx github:OnlyWorlds/create-onlyworlds [folder] --ref <tag>
```

`folder` defaults to `onlyworlds-tool`. `--ref` copies an older release of the starter instead of the newest.

It needs Node.js 22.12 or newer, which is what the starter needs. It reads GitHub's API twice per run, and GitHub allows 60 such reads an hour without signing in, counted per network address (a shared office or a CI runner can already be over it). With a GitHub token in `GITHUB_TOKEN`, or else `GH_TOKEN`, the two reads are signed with it. The token goes to GitHub's API only, never to the host the files come from.

## Next

- [Your first hour](https://onlyworlds.github.io/docs/getting-started/first-hour): read, write, count and delete on the practice world.
- [The TypeScript SDK](https://onlyworlds.github.io/docs/development/typescript).

## License

MIT
