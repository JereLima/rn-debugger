import { create } from "zustand";

export interface LogEntry {
  id: number;
  clientId: string;
  ts: number;
  level: "log" | "info" | "warn" | "error" | "debug";
  args: unknown[];
}

export interface ClientInfo {
  clientId: string;
  connectedAt: number;
  hello?: { device?: any; app?: any };
}

export interface NetEntry {
  id: string;
  clientId: string;
  tsReq: number;
  method: string;
  url: string;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  tsRes?: number;
  status?: number;
  resHeaders?: Record<string, string>;
  resBody?: string;
  duration?: number;
  error?: string;
}

export interface StateSnapshot {
  current: unknown;
  previous: unknown;
  ts: number;
  count: number;
}

export interface StorageEntry { key: string; kind: string; value: unknown }
export interface StorageData { entries: StorageEntry[]; previous: StorageEntry[] | null; ts: number }
export interface StorageEventItem {
  id: number; ts: number; op: "read" | "write" | "delete" | "clear";
  storage: string; key?: string; value?: unknown;
}

export interface DevtoolsFrame { seq: number; text: string }

export interface FsOpEvent {
  id: number; ts: number;
  op: "read" | "write" | "delete";
  n: number; path: string; detail?: string;
}

export interface FsSession {
  reads: number; writes: number; deletes: number;
  startedAt: number; events: FsOpEvent[];
}

const MAX_LOGS = 5000;
const MAX_NETWORK = 1000;

let nextId = 1;

interface Store {
  serverReady: boolean;
  serverError: string | null;
  localIp: string | null;
  clients: Record<string, ClientInfo>;
  logs: LogEntry[];
  network: NetEntry[];
  states: Record<string, StateSnapshot>;
  storages: Record<string, StorageData>;
  storageEvents: StorageEventItem[];
  selectedStorage: string | null;
  devtoolsClientId: string | null;
  devtoolsInbox: DevtoolsFrame[];
  fs: FsSession;

  setServerReady(v: boolean): void;
  setServerError(e: string | null): void;
  setLocalIp(ip: string | null): void;
  clientConnected(clientId: string): void;
  clientDisconnected(clientId: string): void;
  setHello(clientId: string, hello: any): void;
  addLog(clientId: string, msg: any): void;
  clearLogs(): void;
  addNetReq(clientId: string, msg: any): void;
  addNetRes(clientId: string, msg: any): void;
  clearNetwork(): void;
  setStateSnapshot(clientId: string, msg: any): void;
  setStorageSnapshot(msg: any): void;
  addStorageEvent(msg: any): void;
  clearStorageEvents(): void;
  selectStorage(name: string | null): void;
  setDevtoolsClient(clientId: string | null): void;
  pushDevtoolsFrame(text: string): void;
  clearDevtoolsInbox(): void;
  addFsOp(msg: any): void;
  resetFsSession(): void;
}

export const useStore = create<Store>((set) => ({
  serverReady: false,
  serverError: null,
  localIp: null,
  clients: {},
  logs: [],

  network: [],

  states: {},

  storages: {},
  storageEvents: [],
  selectedStorage: null,

  setServerReady: (v) => set({ serverReady: v, serverError: null }),
  setServerError: (e) => set({ serverError: e, serverReady: false }),
  setLocalIp: (ip) => set({ localIp: ip }),
  clientConnected: (clientId) =>
    set((s) => ({
      clients: { ...s.clients, [clientId]: { clientId, connectedAt: Date.now() } },
    })),
  clientDisconnected: (clientId) =>
    set((s) => {
      const clients = { ...s.clients };
      delete clients[clientId];
      return {
        clients,
        devtoolsClientId: s.devtoolsClientId === clientId ? null : s.devtoolsClientId,
      };
    }),
  setHello: (clientId, hello) =>
    set((s) => {
      const prev = s.clients[clientId] ?? { clientId, connectedAt: Date.now() };
      const next = { clients: { ...s.clients, [clientId]: { ...prev, hello } } };
      // M4.5: device com multiplex DevTools via canal SDK.
      if (hello?.app?.reactDevTools === true) {
        return { ...next, devtoolsClientId: clientId };
      }
      return next;
    }),
  addLog: (clientId, msg) =>
    set((s) => {
      const logs = [...s.logs, {
        id: nextId++, clientId, ts: msg.ts, level: msg.level, args: msg.args ?? [],
      }];
      return { logs: logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs };
    }),
  clearLogs: () => set({ logs: [] }),
  addNetReq: (clientId, msg) =>
    set((s) => {
      const network = [...s.network, {
        id: String(msg.id), clientId, tsReq: msg.ts, method: msg.method, url: msg.url,
        reqHeaders: msg.headers, reqBody: msg.body,
      }];
      return { network: network.length > MAX_NETWORK ? network.slice(-MAX_NETWORK) : network };
    }),
  addNetRes: (clientId, msg) =>
    set((s) => {
      const id = String(msg.id);
      // Mesmo device + ainda pendente; fallback: qualquer pendente com mesmo id
      // (contadores `n_N` são por device e podem colidir entre devices).
      let idx = s.network.findIndex((e) => e.id === id && e.clientId === clientId && e.tsRes === undefined);
      if (idx === -1) idx = s.network.findIndex((e) => e.id === id && e.tsRes === undefined);
      let network: NetEntry[];
      if (idx >= 0) {
        network = s.network.slice();
        network[idx] = {
          ...network[idx],
          clientId, tsRes: msg.ts, status: msg.status,
          resHeaders: msg.headers, resBody: msg.body,
          duration: msg.duration, error: msg.error,
        };
      } else {
        // res sem req (req ignorada ou anterior ao connect): não perder o dado.
        network = [...s.network, {
          id: String(msg.id), clientId, tsReq: msg.ts, method: "?", url: msg.url ?? "",
          tsRes: msg.ts, status: msg.status,
          resHeaders: msg.headers, resBody: msg.body,
          duration: msg.duration, error: msg.error,
        }];
      }
      return { network: network.length > MAX_NETWORK ? network.slice(-MAX_NETWORK) : network };
    }),
  clearNetwork: () => set({ network: [] }),
  setStateSnapshot: (_clientId, msg) =>
    set((s) => {
      const name = String(msg.name ?? "state");
      const prev = s.states[name];
      return {
        states: {
          ...s.states,
          [name]: {
            current: msg.state,
            previous: prev?.current ?? null,
            ts: msg.ts,
            count: (prev?.count ?? 0) + 1,
          },
        },
      };
    }),
  setStorageSnapshot: (msg) =>
    set((s) => {
      const name = String(msg.storage ?? "unknown");
      const prev = s.storages[name];
      return {
        storages: {
          ...s.storages,
          [name]: { entries: msg.entries ?? [], previous: prev ? prev.entries : null, ts: msg.ts },
        },
        selectedStorage: s.selectedStorage ?? name,
      };
    }),
  addStorageEvent: (msg) =>
    set((s) => {
      const op = String(msg.type).replace("storage.", "") as StorageEventItem["op"];
      const storageEvents = [...s.storageEvents, {
        id: nextId++, ts: msg.ts, op,
        storage: String(msg.storage ?? ""), key: msg.key, value: msg.value,
      }];
      return { storageEvents: storageEvents.length > 500 ? storageEvents.slice(-500) : storageEvents };
    }),
  clearStorageEvents: () => set({ storageEvents: [] }),
  selectStorage: (name) => set({ selectedStorage: name }),

  devtoolsClientId: null,
  devtoolsInbox: [],

  fs: { reads: 0, writes: 0, deletes: 0, startedAt: Date.now(), events: [] },

  addFsOp: (msg) =>
    set((s) => {
      const op = msg.op === "write" || msg.op === "delete" ? msg.op : "read";
      const n = Number.isFinite(msg.n) ? Number(msg.n) : 0;
      const events = [...s.fs.events, {
        id: nextId++, ts: msg.ts ?? Date.now(), op, n,
        path: String(msg.path ?? "?"), detail: msg.detail,
      }];
      return {
        fs: {
          reads: s.fs.reads + (op === "read" ? n : 0),
          writes: s.fs.writes + (op === "write" ? n : 0),
          deletes: s.fs.deletes + (op === "delete" ? n : 0),
          startedAt: s.fs.startedAt,
          events: events.length > 500 ? events.slice(-500) : events,
        },
      };
    }),
  resetFsSession: () => set({ fs: { reads: 0, writes: 0, deletes: 0, startedAt: Date.now(), events: [] } }),

  setDevtoolsClient: (clientId) => set({ devtoolsClientId: clientId }),
  pushDevtoolsFrame: (text) =>
    set((s) => {
      const devtoolsInbox = [...s.devtoolsInbox, { seq: nextId++, text }];
      return { devtoolsInbox: devtoolsInbox.length > 200 ? devtoolsInbox.slice(-200) : devtoolsInbox };
    }),
  clearDevtoolsInbox: () => set({ devtoolsInbox: [] }),
}));
