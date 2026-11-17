# Building and releasing RUNGUN

The GitHub Actions workflow `.github/workflows/release.yml` builds standalone servers for Windows x64, Linux x64, macOS Intel x64, and macOS Apple Silicon arm64. Players need a supported browser, but do not need Node.js installed.

## Publish a version

1. Commit and push the game changes, workflow, scripts and tests to GitHub.
2. Tag the commit you want to ship, for example `git tag v1.0.1`.
3. Push that tag: `git push origin v1.0.1`.
4. Open Actions → Build and release. After every platform passes, the workflow creates a GitHub Release with four archives and `SHA256SUMS.txt`.

Use a new tag for each version. The workflow can also be run manually from Actions: a branch run uploads downloadable workflow artifacts without publishing; selecting an existing `v*` tag publishes after successful builds. Re-running a tag run replaces matching release assets.

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
