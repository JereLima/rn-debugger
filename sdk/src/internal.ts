import { Platform } from "react-native";
import { Connector } from "./connector";
import { patchConsole } from "./console";
import { patchFetch, patchNetwork, shouldIgnore } from "./network";
import { patchAsyncStorage, patchMMKV } from "./storage";

export interface AddDebugOptions {
  /** Host explícito, ex.: "192.168.1.5". Sobrepõe descoberta automática. */
  host?: string;
  /** Porta do DevBridge (default 9090). */
  port?: number;
}

let started = false;
let connector: Connector | null = null;

// Comandos desktop→device (M3.3: storage.get; M4.5: devtools.res)
let deviceCommandHandler: ((msg: any) => void) | null = null;
export function onDeviceCommand(fn: (msg: any) => void) { deviceCommandHandler = fn; }

export function getConnector(): Connector | null { return connector; }
export function isDebugging(): boolean { return !!connector?.isConnected; }
export function sendRaw(msg: object) { connector?.send(msg); }

const storageRefreshers = new Map<string, () => void>();

export function debugAsyncStorageInternal(AsyncStorage: any) {
  if (!connector || !AsyncStorage) return;
  if (storageRefreshers.has("async-storage")) return; // idempotente
  try {
    const refresh = patchAsyncStorage((m) => { try { connector?.send(m); } catch { /* ignore */ } }, AsyncStorage);
    storageRefreshers.set("async-storage", refresh);
  } catch { /* nunca quebrar o app do usuário */ }
}

export function debugMMKVInternal(instance: any, name = "mmkv") {
  if (!connector || !instance) return;
  const id = `mmkv:${name}`;
  if (storageRefreshers.has(id)) return; // idempotente
  try {
    const refresh = patchMMKV((m) => { try { connector?.send(m); } catch { /* ignore */ } }, instance, name);
    storageRefreshers.set(id, refresh);
  } catch { /* nunca quebrar o app do usuário */ }
}

// Comandos desktop→device (chegam pelo onMessage do Connector):
onDeviceCommand((msg) => {
  try {
    if (msg?.type === "storage.get") storageRefreshers.get(String(msg.storage))?.();
  } catch { /* ignore */ }
});

/** Candidatos, em ordem de prioridade. */
export function buildCandidates(host?: string, devHost?: string): string[] {
  const list: string[] = [];
  if (host) return [host];
  if (devHost) list.push(devHost);                    // IP do dev server (Expo)
  if (Platform.OS === "android") list.push("10.0.2.2"); // emulator → host machine
  list.push("localhost");                             // simulators / adb reverse
  return [...new Set(list)];
}

export function addDebugInternal(
  options: AddDebugOptions,
  extras: { devHost?: string; deviceInfo?: Record<string, unknown>; appName?: string } = {},
) {
  if (started) return;
  if (typeof __DEV__ !== "undefined" && !__DEV__) return; // no-op em produção
  started = true;

  const port = options.port ?? 9090;
  connector = new Connector(
    port,
    (msg) => { try { deviceCommandHandler?.(msg); } catch { /* ignore */ } },
    () => { /* status interno; sem UI no device */ },
  );
  connector.start(buildCandidates(options.host, extras.devHost));

  // Hello assim que conectar — enviado como primeira mensagem enfileirada.
  connector.send({
    v: 1, type: "hello", ts: Date.now(),
    device: {
      platform: Platform.OS,
      platformVersion: String((Platform as any).Version ?? ""),
      ...(extras.deviceInfo ?? {}),
    },
    app: { name: extras.appName ?? "" },
  });

  patchConsole((msg) => { try { connector?.send(msg); } catch { /* ignore */ } });
  patchNetwork((msg) => { try { connector?.send(msg); } catch { /* ignore */ } }, shouldIgnore);
  patchFetch((msg) => { try { connector?.send(msg); } catch { /* ignore */ } }, shouldIgnore);
}
