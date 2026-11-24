# Changelog

## [0.1.0] - unreleased

- Not on npm yet: until the first publish the command is `npx github:OnlyWorlds/create-onlyworlds [folder]`, and the README and the usage text say so.
- The command copies the World Starter at its newest release into a new folder, names the project after it, and prints the next three commands. Every file is checked against the release's own hash before anything is written; a folder that holds anything is left alone. `--ref <tag>` copies another release.
- A GitHub token in `GITHUB_TOKEN`, or else `GH_TOKEN`, signs the two reads of GitHub's API, for a network address that is over GitHub's 60 unsigned reads an hour (a CI runner, a shared office). The token goes to the API only, never to the host the files come from; a token GitHub refuses is named by its variable and never printed.
- `npm test` removes each temporary folder it makes when its test ends, so a run leaves nothing in the system temp folder.
- The next-step `cd` line gives a path with a space between double quotes as it is, so on Windows its backslashes are no longer doubled and the line is the command to type.
