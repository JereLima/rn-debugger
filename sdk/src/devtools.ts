import type { Connector } from "./connector";
import { onDeviceCommand } from "./commands";

/**
 * M4.5 — Multiplexa o protocolo React DevTools sobre o canal SDK (9090).
 * Cobre Expo Go em device físico e RN novo (sem conexão legada à 8097).
 *
 * Formato exato (verificado no backend 6.1.5 embutido no RN):
 * - backend → frontend: onMessage(event, payload) → text = JSON {event, payload}
 * - frontend → backend: text = JSON {event, payload} → listener({event, payload})
 */
let backendListener: ((message: { event: string; payload: unknown }) => void) | null = null;

export function handleDevToolsFrame(msg: any) {
  if (!backendListener) return;
  if (msg?.type !== "devtools.res") return;
  try {
    const parsed = typeof msg.text === "string" ? JSON.parse(msg.text) : msg.text;
    if (parsed && typeof parsed.event === "string") {
      backendListener(parsed);
    }
  } catch { /* frame inválido: ignora */ }
}

export function enableReactDevToolsViaSdk(connector: Connector | null) {
  if (!connector) return;
  try {
    const core = require("react-devtools-core");
    if (!core || typeof core.connectWithCustomMessagingProtocol !== "function") return;
    core.connectWithCustomMessagingProtocol({
      onSubscribe: (listener: (message: any) => void) => {
        backendListener = (message) => { try { listener(message); } catch { /* ignore */ } };
      },
      onUnsubscribe: () => { backendListener = null; },
      onMessage: (event: string, payload: unknown) => {
        try {
          connector.send({
            v: 1, type: "devtools", ts: Date.now(),
            text: JSON.stringify({ event, payload }),
          });
        } catch { /* nunca quebrar o app do usuário */ }
      },
    });
  } catch { /* backend indisponível neste runtime: ignora */ }
}

// Comandos desktop→device chegam pelo dispatch central (internal.ts).
onDeviceCommand((msg: any) => { handleDevToolsFrame(msg); });
