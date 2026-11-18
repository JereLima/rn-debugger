import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

/**
 * Aba React DevTools (M4.3): iframe isolado com o frontend oficial
 * (react-devtools-core/standalone). Relay dupla-mão:
 *   iframe --postMessage--> janela --invoke--> Rust:8097 --> app RN
 *   app RN --> Rust:8097 --devtools-message--> janela --postMessage--> iframe
 */
export function DevToolsTab() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const stateRef = useRef({ iframeReady: false, clientId: null as string | null });
  stateRef.current = { iframeReady, clientId };

  useEffect(() => {
    let cancelled = false;
    const unlistens: (() => void)[] = [];

    const postToIframe = (msg: object) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(msg, "*");
      } catch { /* iframe ainda não carregou */ }
    };

    const onWindowMessage = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = ev.data;
      if (data?.type === "devbridge-devtools-ready") {
        setIframeReady(true);
        // Se o app já estava conectado, avisa o iframe imediatamente.
        if (stateRef.current.clientId) {
          postToIframe({ type: "devbridge-devtools-status", status: "connected" });
        }
      } else if (data?.type === "devbridge-devtools-out") {
        // Frame do frontend → app RN via servidor 8097.
        invoke("ws_broadcast", { server: "devtools", text: String(data.text) }).catch(() => { /* ignore */ });
      }
    };
    window.addEventListener("message", onWindowMessage);

    (async () => {
      try {
        unlistens.push(await listen<{ clientId: string }>("devtools-client-connected", (e) => {
          if (cancelled) return;
          setClientId(e.payload.clientId);
          postToIframe({ type: "devbridge-devtools-status", status: "connected" });
        }));
        unlistens.push(await listen<{ clientId: string }>("devtools-client-disconnected", () => {
          if (cancelled) return;
          setClientId(null);
          postToIframe({ type: "devbridge-devtools-status", status: "close" });
        }));
        unlistens.push(await listen<{ clientId: string; text: string }>("devtools-message", (e) => {
          if (cancelled) return;
          postToIframe({ type: "devbridge-devtools-in", text: e.payload.text });
        }));
      } catch {
        // Tauri indisponível (ex.: preview no browser puro): aba mostra o header explicativo.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onWindowMessage);
      unlistens.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
        {clientId ? (
          <span className="font-mono">device: <span className="text-emerald-400">{clientId.slice(0, 8)}…</span> conectado na 8097</span>
        ) : (
          <span>Aguardando app (simulator conecta sozinho; Android físico: adb reverse tcp:8097 tcp:8097)</span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        src="/devtools.html"
        title="React DevTools"
        className="h-full w-full flex-1 bg-[#0a0a0a]"
      />
      {!iframeReady && <p className="p-2 text-xs text-zinc-600">carregando DevTools…</p>}
    </div>
  );
}
