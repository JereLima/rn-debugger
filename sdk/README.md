# rn-debugger

Zero-config debugger for React Native and Expo apps. Desktop app (**RN Debugger**, macOS/Windows/Linux) + this SDK.

Console · Network · State (Zustand/Redux) · Storage (AsyncStorage/MMKV) · React DevTools — in one place.

## Install

```bash
npm i rn-debugger
```

## Quickstart

```ts
// Expo (App.tsx) — first line of the file
import { addDebug } from "rn-debugger/expo";
addDebug();

// Plain React Native (index.js) — simulator: zero config; physical device: manual host
import { addDebug } from "rn-debugger";
addDebug({ host: "192.168.1.5" });
```

## API

```ts
addDebug(options?: { host?: string; port?: number; reactDevTools?: boolean })

// State
debugState(name, getState, subscribe?)
debugRedux(store, name?)
debugZustand(store, name?)

// Storage — always pass the module/instance as an argument
debugAsyncStorage(AsyncStorage)
debugMMKV(instance, name?)
```

## Multiple stores

One `debugZustand`/`debugRedux` call per store, each with a unique name. Every name gets its own entry — with its own diff — in the desktop **State** tab.

```ts
debugZustand(useCart, "cart");
debugZustand(useUser, "user");
debugZustand(useUi, "ui");
```

Names must be unique (the default is `"zustand"`, so unnamed calls collide). Many stores are cheap: snapshots are throttled and only sent when state actually changes.

Optional batch helper for your project:

```ts
import { debugZustand } from "rn-debugger/expo";

export function debugStores(stores: Record<string, unknown>) {
  for (const [name, store] of Object.entries(stores)) debugZustand(store, name);
}

debugStores({ cart: useCart, user: useUser, ui: useUi });
```

Tip: call `debugZustand` right where each store is created — monitoring travels with the store module, no central setup needed.

Dev-only: no-op in production (`__DEV__ === false`).

Download the desktop app from [GitHub Releases](https://github.com/JereLima/rn-debugger/releases).
