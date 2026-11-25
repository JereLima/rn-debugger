# Contributing

Thanks for helping improve rn-debugger! This repo is a monorepo:

- `app/` — the Tauri desktop app (React + Vite frontend, Rust backend)
- `sdk/` — the npm package users install in their apps (`rn-debugger`)
- `example/` — an Expo app used to dogfood every feature

## Dev setup

- **Node.js 22+** and **pnpm** (`corepack enable`)
- **Rust stable** (for the Tauri backend) — https://rustup.rs
- **Xcode** (macOS) and/or **Android SDK** — only needed to run the `example/` app on devices

```bash
git clone https://github.com/JereLima/rn-debugger.git
cd rn-debugger
pnpm install

# Desktop app (starts Vite + Tauri dev)
pnpm app

# SDK watch mode (rebuilds dist/ on change)
pnpm sdk

# Example app (uses npm internally, on purpose — see below)
pnpm example
```

### The example uses npm, not pnpm

The example is **outside** the pnpm workspace on purpose: pnpm symlinks break Metro's module resolution for the SDK. The example installs a **copy** of the SDK instead:

```bash
# after changing SDK code — rebuild + re-sync the copy into example/
pnpm --filter rn-debugger build
cd example && npm install ../sdk
```

> **Metro caches `node_modules` transforms.** After re-syncing the SDK copy, restart the
> dev server with `npx expo start --clear` — otherwise Metro keeps serving the old
> bundle and your SDK changes silently never load (the app connects fine, but the new
> code never runs). If an SDK change "doesn't work", this is the first thing to check.

## Workflow

1. Fork, create a branch from `main`
2. Make your change. Run the relevant checks:

   ```bash
   pnpm --filter rn-debugger build     # SDK builds
   pnpm --filter app build             # desktop frontend builds
   cargo check --manifest-path app/src-tauri/Cargo.toml
   ```

3. If your change touches the SDK or the connection flow, dogfood it: run `pnpm app`, start the example, and verify the affected feature end-to-end (simulator or device).
4. Open a PR following the template: what, why, how you tested it.

## Conventions

- **Commits:** conventional commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`)
- **TypeScript strict** everywhere; **no `unsafe`** in Rust; **no `panic!`** in network code
- The SDK must stay **zero runtime dependencies** and must never break the user's app — every send/patch is wrapped in try/catch
- Port **9090** (SDK channel) and **8097** (React DevTools) are part of the public contract — don't change them casually
