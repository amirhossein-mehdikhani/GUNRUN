# Building and releasing RUNGUN

The GitHub Actions workflow `.github/workflows/release.yml` builds standalone servers for Windows x64, Linux x64, macOS Intel x64, and macOS Apple Silicon arm64. Players need a supported browser, but do not need Node.js installed.

## Publish a version

1. Commit and push the game changes, workflow, scripts and tests to GitHub.
2. Open Actions → Build and release → Run workflow and select `main`.
3. After every platform passes, the workflow tags the exact built commit and creates a GitHub Release with four archives and `SHA256SUMS.txt`.
4. The first automatic tag starts at package.json's version (currently `v1.0.0`). New commits increment the highest stable patch version: `v1.0.1`, `v1.0.2`, and so on. A higher package.json version can request a minor or major bump.

Manual branch runs now publish as well as build. Retrying the same tagged commit reuses its version rather than creating a duplicate release. You can still push an explicit `vMAJOR.MINOR.PATCH` tag to trigger the workflow. Re-running a tag run replaces matching release assets. Creating the automatic tag with GitHub's workflow token does not trigger a second build; publishing happens in the current run. Repository-wide workflow concurrency serializes version allocation.

Each platform installs the lockfile dependencies, runs the regression suite, packages with `@yao-pkg/pkg`, and starts the resulting executable from a temporary directory outside the checkout. The smoke check verifies HTML, embedded browser dependencies and model assets, and a real Socket.IO WebSocket ping. Publishing waits for every build. Build jobs have read-only repository access; only the release job gets contents write permission through GitHub's automatic token. No personal token is required.

## Download and run

- Windows: extract `rungun-windows-x64.zip`, then run `fps-lan-server-win.exe`.
- Intel Mac: extract `rungun-macos-x64.tar.gz`, then run `./fps-lan-server-macos` from Terminal.
- Apple Silicon Mac: use `rungun-macos-arm64.tar.gz` and the same command.
- Linux: extract `rungun-linux-x64.tar.gz`, then run `./fps-lan-server-linux`.

macOS executables are not notarized with an Apple Developer identity. Signing/notarization is a future distribution improvement; this workflow does not bypass operating-system security checks. Linux binaries are built on Ubuntu 22.04 and require a compatible glibc system. ARM Linux and Windows ARM are not included.

## Local checks

```sh
npm ci
npm test
npm run build:win
```

On Windows, verify the package using `node scripts/smoke-binary.mjs`. On another platform, set `BUILD_BINARY` to its matching executable name first. The smoke check uses port 31879 and shuts down its own test process afterward. Packaging downloads a patched Node.js runtime on the first build; network access to the pkg binary releases is necessary.

The workflow must first be pushed before it appears in GitHub Actions. Local preparation alone does not create a release.
