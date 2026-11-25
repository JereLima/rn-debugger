import { Platform } from "react-native";
import { Connector } from "./connector";
import { patchConsole } from "./console";
import { patchFetch, patchNetwork, shouldIgnore } from "./network";
import { patchAsyncStorage, patchMMKV } from "./storage";
import { patchFirestore, registerFsRun } from "./firestore";
import { dispatchDeviceCommand, onDeviceCommand } from "./commands";
import { enableReactDevToolsViaSdk } from "./devtools";

export interface AddDebugOptions {
  /** Host explícito, ex.: "192.168.1.5". Sobrepõe descoberta automática. */
  host?: string;
  /** Porta do RN Debugger (default 9090). */
  port?: number;
  /** Multiplexa o React DevTools sobre o canal SDK (Expo Go / RN sem 8097). */
  reactDevTools?: boolean;
}

let started = false;
let connector: Connector | null = null;

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

export function debugFirestoreInternal(api: any, db: any, options: any = {}) {
  if (!connector || !api) return;
  try {
    const sendToDesktop = (m: object) => { try { connector?.send(m); } catch { /* ignore */ } };
    // patchFirestore é idempotente por módulo (api.__dbFirestore).
    patchFirestore(sendToDesktop, api, db, options);
    // Comandos fs.run: o desktop executa writes pelo device (o resultado
    // volta ao feed via as funções instrumentadas acima).
    registerFsRun(api, sendToDesktop);
  } catch { /* nunca quebrar o app do usuário */ }
}

// Comandos desktop→device (chegam pelo dispatch central do Connector):
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

  /** Hello em cada (re)conexão. Sem isso, um restart do app desktop deixa a
   *  sessão fantasma: o socket reconecta, mas o desktop nunca re-registra o
   *  app e a UI fica vazia até o app recarregar. O Connector chama onStatus
   *  ("connected") antes do flush da fila, então o hello chega sempre primeiro. */
  const sendHello = () => {
    try {
      connector?.send({
        v: 1, type: "hello", ts: Date.now(),
        device: {
          platform: Platform.OS,
          platformVersion: String((Platform as any).Version ?? ""),
          ...(extras.deviceInfo ?? {}),
        },
        app: { name: extras.appName ?? "", ...(options.reactDevTools ? { reactDevTools: true } : {}) },
      });
    } catch { /* nunca quebrar o app do usuário */ }
  };

  connector = new Connector(
    port,
    (msg) => { dispatchDeviceCommand(msg); },
    (status) => { if (status === "connected") sendHello(); },
  );
  connector.start(buildCandidates(options.host, extras.devHost));

  if (options.reactDevTools) {
    try { enableReactDevToolsViaSdk(connector); } catch { /* nunca quebrar o app do usuário */ }
  }

  patchConsole((msg) => { try { connector?.send(msg); } catch { /* ignore */ } });
  patchNetwork((msg) => { try { connector?.send(msg); } catch { /* ignore */ } }, shouldIgnore);
  patchFetch((msg) => { try { connector?.send(msg); } catch { /* ignore */ } }, shouldIgnore);
}
