# devbridge

Zero-config debugger for React Native and Expo apps. Desktop app (DevBridge) + this SDK.

## Quickstart

```ts
// Expo (App.tsx) — primeira linha do arquivo
import { addDebug } from "devbridge/expo";
addDebug();

// RN puro (índice.js) — simulator: zero config; device físico: host manual
import { addDebug } from "devbridge";
addDebug({ host: "192.168.1.5" });
```

Dev-only: no-op em produção (`__DEV__ === false`).
