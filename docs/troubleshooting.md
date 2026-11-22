# Troubleshooting

## Connection

| Symptom | Likely cause | Fix |
|---|---|---|
| Physical Android/iOS device doesn't connect | Desktop firewall blocking inbound port 9090 | Allow TCP 9090 in your firewall (Windows: Firewall → Inbound Rules). Make sure both are on the same Wi-Fi |
| Connects on simulator but not in Expo Go | `expoConfig.hostUri` missing (started with `--tunnel` or `--localhost`) | Start `npx expo start` in LAN mode, or `addDebug({ host: "YOUR-IP" })` |
| `[rn-debugger] sdk server failed: Address already in use` | Reactotron or another app on port 9090 | Close the other app |
| App breaks when the desktop app is closed/paused | Unhandled error in send | Every SDK send is wrapped in try/catch — if you see this, please open an issue |
| Android emulator doesn't connect React DevTools | The emulator's `localhost` is not your machine | `adb reverse tcp:8097 tcp:8097` |
| iOS physical device doesn't connect React DevTools | No route to port 8097 | Use `addDebug({ reactDevTools: true })` (multiplexed over port 9090) |

## Console

| Symptom | Likely cause | Fix |
|---|---|---|
| Duplicated logs | Patch calling the original twice | Open an issue — the wrapper should call the original exactly once |
| Device console polluted with SDK WebSocket errors | Visible reconnection attempts | The SDK never logs its own failures; if you see this, open an issue |

## Network

| Symptom | Likely cause | Fix |
|---|---|---|
| Network tab empty but the app makes requests | Library bypasses XHR with native networking | Open an issue with the library name |

## React DevTools

| Symptom | Likely cause | Fix |
|---|---|---|
| DevTools iframe is blank | Missing Node stub or `process.env` not defined | Check the iframe console; open an issue |
| DevTools connects and disconnects in a loop | `react-devtools-core` version in the app ≠ the embedded frontend | Check `npm ls react-devtools-core` in your app |

## Storage

| Symptom | Likely cause | Fix |
|---|---|---|
| MMKV doesn't show up in Expo Go | `react-native-mmkv` is a native module — not available in Expo Go | Use a development build (`expo-dev-client`) to test MMKV |
| MMKV shows snapshots but no live events | Instance doesn't allow method overrides (frozen/proxy) | Accepted degradation — manual refresh still works |
| Metro can't resolve `@react-native-async-storage/async-storage` | Package not installed | `npx expo install @react-native-async-storage/async-storage` |
| Duplicated storage events | `debugAsyncStorage()` called twice | The SDK is idempotent; if you see this, open an issue |

## Still stuck?

Open an issue with: RN/Expo version, `rn-debugger` version, desktop OS, and what happened vs. what you expected.
