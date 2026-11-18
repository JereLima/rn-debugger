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
}

export const useStore = create<Store>((set) => ({
  serverReady: false,
  serverError: null,
  localIp: null,
  clients: {},
  logs: [],

  network: [],

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
      return { clients };
    }),
  setHello: (clientId, hello) =>
    set((s) => {
      const prev = s.clients[clientId] ?? { clientId, connectedAt: Date.now() };
      return { clients: { ...s.clients, [clientId]: { ...prev, hello } } };
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
}));
