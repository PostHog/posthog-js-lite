Releasing
=========

 1. Update the `CHANGELOG.md` with the version and date (each package has its own `CHANGELOG.md`).
 2. Update the `version` in the `package.json` file (each package has its own `package.json`).
 3. Open a PR with the changes.
 4. After merging the PR, The GH Action (release.yml) is doing everything else automatically.
    1. For React Native, the `scripts.prebuild` (`package.json`) is generating a `version.ts` file with the version which is used at runtime.
 5. Done.
