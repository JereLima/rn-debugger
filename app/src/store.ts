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

const MAX_LOGS = 5000;

let nextId = 1;

interface Store {
  serverReady: boolean;
  serverError: string | null;
  localIp: string | null;
  clients: Record<string, ClientInfo>;
  logs: LogEntry[];

  setServerReady(v: boolean): void;
  setServerError(e: string | null): void;
  setLocalIp(ip: string | null): void;
  clientConnected(clientId: string): void;
  clientDisconnected(clientId: string): void;
  setHello(clientId: string, hello: any): void;
  addLog(clientId: string, msg: any): void;
  clearLogs(): void;
}

export const useStore = create<Store>((set) => ({
  serverReady: false,
  serverError: null,
  localIp: null,
  clients: {},
  logs: [],

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
}));
