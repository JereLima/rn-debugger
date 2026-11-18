import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store";

/**
 * Aba React DevTools (M4.3 + M4.5): iframe isolado com o frontend oficial
 * (react-devtools-core/standalone). Dois caminhos de relay:
 *   M4.5 (multiplex via SDK/9090): device --devtools--> inbox (store) --postMessage--> iframe;
 *     iframe --postMessage--> ws_send_to(sdk, devtoolsClientId) --> device (devtools.res).
 *   Legado (M4.1–M4.4, direto na 8097): device --devtools-message--> iframe;
 *     iframe --postMessage--> ws_broadcast(devtools) --> device.
 */
export function DevToolsTab() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [directClientId, setDirectClientId] = useState<string | null>(null);

  // M4.5
  const devtoolsClientId = useStore((s) => s.devtoolsClientId);
  const inbox = useStore((s) => s.devtoolsInbox);
  const lastSentSeq = useRef(0);

  // Encaminha frames novos do inbox (via SDK) para o iframe.
  // Só após o iframe pronto; o inbox acumula (cap 200) até lá.
  useEffect(() => {
    if (!iframeReady) return;
    const fresh = inbox.filter((f) => f.seq > lastSentSeq.current);
    if (fresh.length === 0) return;
    lastSentSeq.current = fresh[fresh.length - 1].seq;
    for (const f of fresh) {
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: "devbridge-devtools-in", text: f.text }, "*");
      } catch { /* janela indisponível: descarta (inbox mantém cap 200) */ }
    }
  }, [inbox, iframeReady]);

  const stateRef = useRef({ iframeReady: false, directClientId: null as string | null });
  stateRef.current = { iframeReady, directClientId };

  useEffect(() => {
    let cancelled = false;
    const unlistens: (() => void)[] = [];

    const postToIframe = (msg: object) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(msg, "*");
      } catch { /* iframe ainda não carregou */ }
    };

    const sendOut = (text: string) => {
      // M4.5 primeiro: resposta direta ao device multiplexado.
      const target = useStore.getState().devtoolsClientId;
      if (target) {
        invoke("ws_send_to", { server: "sdk", clientId: target, text }).catch(() => { /* ignore */ });
      } else {
        // Legado: broadcast na 8097.
        invoke("ws_broadcast", { server: "devtools", text }).catch(() => { /* ignore */ });
      }
    };

    const onWindowMessage = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = ev.data;
      if (data?.type === "devbridge-devtools-ready") {
        setIframeReady(true);
        if (stateRef.current.directClientId) {
          postToIframe({ type: "devbridge-devtools-status", status: "connected" });
        }
      } else if (data?.type === "devbridge-devtools-out") {
        sendOut(String(data.text));
      }
    };
    window.addEventListener("message", onWindowMessage);

    (async () => {
      try {
        // M4.5: frames via SDK chegam pelo inbox (store) — nada a ouvir aqui.
        // Legado: conexão direta na 8097.
        unlistens.push(await listen<{ clientId: string }>("devtools-client-connected", (e) => {
          if (cancelled) return;
          setDirectClientId(e.payload.clientId);
          postToIframe({ type: "devbridge-devtools-status", status: "connected" });
        }));
        unlistens.push(await listen<{ clientId: string }>("devtools-client-disconnected", () => {
          if (cancelled) return;
          setDirectClientId(null);
          postToIframe({ type: "devbridge-devtools-status", status: "close" });
        }));
        unlistens.push(await listen<{ clientId: string; text: string }>("devtools-message", (e) => {
          if (cancelled) return;
          postToIframe({ type: "devbridge-devtools-in", text: e.payload.text });
        }));
      } catch {
        // Tauri indisponível (ex.: preview no browser puro): header explicativo.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onWindowMessage);
      unlistens.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    };
  }, []);

  const connectedLabel = devtoolsClientId
    ? <>device (multiplex SDK): <span className="text-emerald-400">{devtoolsClientId.slice(0, 8)}…</span></>
    : directClientId
      ? <>device: <span className="text-emerald-400">{directClientId.slice(0, 8)}…</span> conectado na 8097</>
      : <>Aguardando app (simulator conecta sozinho; Android físico: adb reverse tcp:8097 tcp:8097; Expo Go: addDebug({"{"} reactDevTools: true {"}"}))</>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-400">
        {connectedLabel}
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
