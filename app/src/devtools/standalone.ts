// Roda DENTRO do iframe. Comunica-se com a janela principal via postMessage;
// a janela principal faz o invoke() no Tauri.
import "./polyfills";
import * as StandaloneNS from "react-devtools-core/standalone";

// WebSocket falso: o que o frontend envia vai pro parent; o que chega do parent
// é despachado como evento "message".
class ParentBridgeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 1; // OPEN

  private listeners = new Map<string, Set<(ev: any) => void>>();

  constructor() {
    window.addEventListener("message", (ev: MessageEvent) => {
      const data = ev.data;
      if (data?.type === "devbridge-devtools-in") {
        this.dispatch("message", { data: data.text });
      } else if (data?.type === "devbridge-devtools-status") {
        this.dispatch(data.status === "connected" ? "open" : "close", {});
      }
    });
    window.parent?.postMessage({ type: "devbridge-devtools-ready" }, "*");
  }

  addEventListener(type: string, cb: (ev: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: (ev: any) => void) {
    this.listeners.get(type)?.delete(cb);
  }
  dispatch(type: string, ev: any) { this.listeners.get(type)?.forEach((cb) => cb(ev)); }

  send(text: string) {
    window.parent?.postMessage({ type: "devbridge-devtools-out", text }, "*");
  }
  close() { /* lifecycle controlado pelo parent */ }
}

// A forma do export varia com o interop CJS↔ESM do bundler
// (dev: namespace { default: { default: api } }; prod pode diferir).
// Resolve em runtime pelo formato real, não pela suposição.
function resolveApi(ns: any) {
  const cands = [ns, ns?.default, ns?.default?.default];
  for (const c of cands) {
    if (c && typeof c.setContentDOMNode === "function" && typeof c.connectToSocket === "function") {
      return c as {
        setContentDOMNode(node: HTMLElement | null): unknown;
        connectToSocket(socket: unknown): { close(): void };
      };
    }
  }
  throw new Error("[devtools] react-devtools-core/standalone API not found");
}

const DevtoolsUI = resolveApi(StandaloneNS as any);

DevtoolsUI.setContentDOMNode(document.getElementById("devtools")!);
DevtoolsUI.connectToSocket(new ParentBridgeSocket() as unknown as WebSocket);
