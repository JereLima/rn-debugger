import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useStore } from "../store";

export function StatusCard() {
  const serverReady = useStore((s) => s.serverReady);
  const serverError = useStore((s) => s.serverError);
  const localIp = useStore((s) => s.localIp);
  const clientCount = useStore((s) => Object.keys(s.clients).length);
  const [copied, setCopied] = useState(false);

  async function copyAddr() {
    if (!localIp) return;
    try {
      await navigator.clipboard.writeText(`ws://${localIp}:9090`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  }

  return (
    <div className="rounded-lg bg-zinc-800/80 p-3 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            serverReady ? "bg-emerald-400" : serverError ? "bg-red-400" : "bg-amber-400"
          }`}
        />
        {serverReady ? (
          <span className="font-mono text-zinc-200">Listening :9090</span>
        ) : serverError ? (
          <span className="text-red-300">porta 9090 ocupada — verifique Reactotron/outro app</span>
        ) : (
          <span className="text-zinc-400">iniciando servidor…</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-zinc-400">
          {localIp ? `ws://${localIp}:9090` : "descobrindo IP…"}
        </span>
        {localIp && (
          <button
            onClick={copyAddr}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            title="Copiar endereço"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>

      {clientCount === 0 && (
        <p className="mt-2 text-zinc-500">Aguardando app… adicione addDebug() e rode o app</p>
      )}
    </div>
  );
}
