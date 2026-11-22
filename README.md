# rn-debugger

**The zero-config debugger for React Native & Expo.**

[![npm](https://img.shields.io/npm/v/rn-debugger)](https://www.npmjs.com/package/rn-debugger)
[![CI](https://github.com/JereLima/rn-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/JereLima/rn-debugger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

One desktop app (macOS / Windows / Linux) with everything you need while developing a React Native app:

- **Console** — logs, warns, errors (with stack), safe object serialization, search & filters
- **Network** — every fetch/XHR with method, status, duration, headers and pretty JSON bodies
- **State** — Zustand / Redux / any store, with snapshots and visual **diff** of what changed
- **Storage** — AsyncStorage, MMKV and Firestore (experimental) keys, values and a live event feed
- **React DevTools** — the official component tree, embedded

## Quickstart

1. Download the desktop app for your OS from [Releases](https://github.com/JereLima/rn-debugger/releases)
2. Install the SDK in your app:

   ```bash
   npm i rn-debugger
   ```

3. Add it to your `App.tsx` (Expo):

   ```ts
   import { addDebug } from "rn-debugger/expo";
   addDebug();
   ```

   Plain React Native (`index.js`) — zero config on simulators, manual host on physical devices:

   ```ts
   import { addDebug } from "rn-debugger";
   addDebug({ host: "192.168.1.5" });
   ```

4. Run your app — it connects automatically. That's it.

No config file, no native modules, works in **Expo Go**. Dev-only: the SDK is a no-op in production builds (`__DEV__ === false`).

## How it connects

The desktop app runs a WebSocket server on port **9090**. The SDK tries, in order: an explicit `host`, the Expo dev server IP (from the app manifest — this is why it's zero-config in Expo Go, even on physical devices), `10.0.2.2` (Android emulator) and `localhost`. First one that answers wins; it reconnects automatically.

## API

```ts
addDebug(options?: { host?: string; port?: number; reactDevTools?: boolean })

// State — snapshots + diff
debugState(name, getState, subscribe?)
debugRedux(store, name?)
debugZustand(store, name?)

// Storage — always pass the module/instance as an argument
debugAsyncStorage(AsyncStorage)
debugMMKV(instance, name?)
```

## Comparison

| | rn-debugger | Reactotron | react-native-debugger | Flipper |
|---|---|---|---|---|
| Maintained | ✅ | slow | legacy (no Hermes / new arch) | discontinued |
| Setup | `addDebug()` | setup + manual host | bundler flags | native app on device |
| Works in Expo Go | ✅ | ✅ | ❌ | ❌ |
| Storage (AsyncStorage/MMKV/Firestore) | ✅ | partial | ❌ | via JS plugins |
| React DevTools | ✅ | ❌ | ✅ | ❌ |

## Troubleshooting

Device not connecting? Windows firewall, `--tunnel` mode, port conflicts and more in [docs/troubleshooting.md](docs/troubleshooting.md).

**macOS note:** first releases are unsigned. If macOS blocks the app:

```bash
xattr -cr /Applications/RN\ Debugger.app
```

## Roadmap

- [ ] v0.1 — console, network, state, storage, React DevTools *(current)*
- [ ] Stable Firestore inspector (currently experimental)
- [ ] Editable state (dispatch actions from the desktop)
- [ ] Request replay / mock

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT license — see [LICENSE](LICENSE).
