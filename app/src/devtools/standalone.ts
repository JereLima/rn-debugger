// Roda DENTRO do iframe. Comunica-se com a janela principal via postMessage;
// a janela principal faz o invoke() no Tauri.
import DevtoolsUI from "react-devtools-core/standalone";

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

DevtoolsUI.setContentDOMNode(document.getElementById("devtools")!);
DevtoolsUI.connectToSocket(new ParentBridgeSocket() as unknown as WebSocket);
