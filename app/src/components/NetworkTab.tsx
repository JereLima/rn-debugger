import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JSONTree } from "react-json-tree";
import { Copy, X } from "lucide-react";
import type { NetEntry } from "../store";
import { useStore } from "../store";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const STATUS_GROUPS = ["2xx", "3xx", "4xx", "5xx", "error"] as const;
type StatusGroup = (typeof STATUS_GROUPS)[number];

const JSON_THEME = {
  scheme: "rndebugger",
  base00: "transparent",
  base01: "#3f3f46",
  base02: "#52525b",
  base03: "#71717a",
  base04: "#a1a1a8",
  base05: "#d4d4d8",
  base06: "#e4e4e7",
  base07: "#f4f4f5",
  base08: "#f87171",
  base09: "#fb923c",
  base0A: "#facc15",
  base0B: "#4ade80",
  base0C: "#22d3ee",
  base0D: "#60a5fa",
  base0E: "#c084fc",
  base0F: "#f472b6",
} as any;

function statusGroupOf(e: NetEntry): StatusGroup | "pending" {
  if (e.error || e.status === 0) return "error";
  if (e.status === undefined) return "pending";
  if (e.status >= 500) return "5xx";
  if (e.status >= 400) return "4xx";
  if (e.status >= 300) return "3xx";
  return "2xx";
}

function statusStyle(e: NetEntry): string {
  const g = statusGroupOf(e);
  switch (g) {
    case "2xx": return "text-emerald-400";
    case "3xx": return "text-sky-400";
    case "4xx": return "text-orange-400";
    case "5xx":
    case "error": return "text-red-400";
    default: return "text-zinc-500";
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function durationStyle(ms?: number): string {
  if (ms === undefined) return "text-zinc-500";
  if (ms > 2000) return "text-red-400";
  if (ms > 500) return "text-amber-300";
  return "text-zinc-400";
}

function CopyButton({ text }: { text: string }) {
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }
  return (
    <button onClick={copy} className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200" title="Copiar">
      <Copy size={13} />
    </button>
  );
}

function BodyView({ body, contentType }: { body?: string; contentType?: string }) {
  if (body === undefined || body === "") return <span className="text-xs text-zinc-600">(vazio)</span>;
  if (contentType?.includes("json")) {
    try {
      const parsed = JSON.parse(body);
      return (
        <JSONTree data={parsed} hideRoot theme={JSON_THEME} invertTheme={false}
          shouldExpandNodeInitially={() => false} />
      );
    } catch { /* cai para texto cru */ }
  }
  return <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-300">{body}</pre>;
}

function DetailDrawer({ entry, onClose }: { entry: NetEntry; onClose: () => void }) {
  const resContentType = entry.resHeaders?.["content-type"];
  return (
    <div className="flex h-full w-[45%] shrink-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-200">
              {entry.method}
            </span>
            <span className={`font-mono text-xs font-bold ${statusStyle(entry)}`}>
              {entry.error ? "ERROR" : entry.status ?? "…"}
            </span>
            {entry.duration !== undefined && (
              <span className={`font-mono text-xs ${durationStyle(entry.duration)}`}>{entry.duration}ms</span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-zinc-300">{entry.url}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200" title="Fechar">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <Section title="Request Headers" copy={entry.reqHeaders ? JSON.stringify(entry.reqHeaders, null, 2) : ""}>
          {entry.reqHeaders && Object.keys(entry.reqHeaders).length > 0 ? (
            <JSONTree data={entry.reqHeaders} hideRoot theme={JSON_THEME} invertTheme={false}
              shouldExpandNodeInitially={() => false} />
          ) : <Empty />}
        </Section>
        <Section title="Request Body" copy={entry.reqBody ?? ""}>
          <BodyView body={entry.reqBody} />
        </Section>
        <Section title="Response Headers" copy={entry.resHeaders ? JSON.stringify(entry.resHeaders, null, 2) : ""}>
          {entry.tsRes === undefined ? (
            <span className="text-xs text-zinc-500">pendente…</span>
          ) : entry.resHeaders && Object.keys(entry.resHeaders).length > 0 ? (
            <JSONTree data={entry.resHeaders} hideRoot theme={JSON_THEME} invertTheme={false}
              shouldExpandNodeInitially={() => false} />
          ) : <Empty />}
        </Section>
        <Section title="Response Body" copy={entry.resBody ?? ""}>
          {entry.tsRes === undefined ? (
            <span className="text-xs text-zinc-500">pendente…</span>
          ) : entry.error ? (
            <span className="font-mono text-xs text-red-300">{entry.error}</span>
          ) : (
            <BodyView body={entry.resBody} contentType={resContentType} />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h4>
        {copy && <CopyButton text={copy} />}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <span className="text-xs text-zinc-600">(vazio)</span>;
}

export function NetworkTab() {
  const network = useStore((s) => s.network);
  const clearNetwork = useStore((s) => s.clearNetwork);
  const [query, setQuery] = useState("");
  const [methodsOff, setMethodsOff] = useState<Record<string, boolean>>({});
  const [statusOff, setStatusOff] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return network.filter((e) => {
      if (methodsOff[e.method]) return false;
      const g = statusGroupOf(e);
      if (g !== "pending" && statusOff[g]) return false;
      if (q && !e.url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [network, query, methodsOff, statusOff]);

  const selected = selectedId ? network.find((e) => e.id === selectedId) ?? null : null;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  return (
    <div className="flex h-full">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por URL…"
            className="w-56 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <div className="flex gap-1">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setMethodsOff((d) => ({ ...d, [m]: !d[m] }))}
                className={`rounded px-2 py-1 font-mono text-[10px] font-bold ${
                  methodsOff[m] ? "bg-zinc-800 text-zinc-600 line-through" : "bg-zinc-700 text-zinc-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {STATUS_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setStatusOff((d) => ({ ...d, [g]: !d[g] }))}
                className={`rounded px-2 py-1 font-mono text-[10px] font-bold ${
                  statusOff[g] ? "bg-zinc-800 text-zinc-600 line-through" : "bg-zinc-700 text-zinc-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            onClick={clearNetwork}
            className="ml-auto rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            Limpar
          </button>
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-zinc-500">
              {network.length === 0 ? "Nenhuma requisição ainda — use fetch no app." : "Nenhuma requisição corresponde ao filtro."}
            </p>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((v) => {
                const e = filtered[v.index];
                const pending = e.tsRes === undefined;
                return (
                  <div
                    key={`${e.clientId}:${e.id}`}
                    style={{
                      position: "absolute", top: 0, left: 0, width: "100%",
                      transform: `translateY(${v.start}px)`,
                    }}
                    ref={virtualizer.measureElement}
                    data-index={v.index}
                  >
                    <button
                      onClick={() => setSelectedId(e.id)}
                      className={`flex w-full items-center gap-3 border-b border-zinc-800/60 px-3 py-1.5 text-left hover:bg-zinc-800/50 ${
                        selectedId === e.id ? "bg-zinc-800/70" : ""
                      }`}
                    >
                      <span className="w-14 shrink-0 font-mono text-[11px] font-bold text-zinc-300">{e.method}</span>
                      <span className={`w-12 shrink-0 font-mono text-[11px] font-bold ${statusStyle(e)}`}>
                        {pending ? "…" : e.error ? "ERR" : e.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">{shortUrl(e.url)}</span>
                      <span className={`w-16 shrink-0 text-right font-mono text-[11px] ${durationStyle(e.duration)}`}>
                        {pending ? <span className="text-zinc-600">○</span> : `${e.duration}ms`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && <DetailDrawer entry={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
