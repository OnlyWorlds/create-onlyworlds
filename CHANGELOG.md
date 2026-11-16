# Changelog

## [0.1.0] - unreleased

- Not on npm yet: until the first publish the command is `npx github:OnlyWorlds/create-onlyworlds [folder]`, and the README and the usage text say so.
- The command copies the World Starter at its newest release into a new folder, names the project after it, and prints the next three commands. Every file is checked against the release's own hash before anything is written; a folder that holds anything is left alone. `--ref <tag>` copies another release.
