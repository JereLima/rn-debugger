import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store";

export async function initBridge() {
  const s = useStore.getState();

  await listen<{ port: number }>("sdk-server-ready", () => s.setServerReady(true));
  await listen<{ error: string }>("sdk-server-error", (e) => s.setServerError(e.payload.error));
  await listen<{ clientId: string }>("sdk-client-connected", (e) => s.clientConnected(e.payload.clientId));
  await listen<{ clientId: string }>("sdk-client-disconnected", (e) =>
    s.clientDisconnected(e.payload.clientId),
  );
  await listen<{ clientId: string; text: string }>("sdk-message", (e) => {
    const { clientId, text } = e.payload;
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }
    switch (msg?.type) {
      case "hello": s.setHello(clientId, msg); break;
      case "log": s.addLog(clientId, msg); break;
      // M2: network | M3: "state.snapshot" + storage.* | M4.2: "devtools"
    }
  });

  try { s.setLocalIp(await invoke<string | null>("get_local_ip")); } catch { /* ignore */ }
}
