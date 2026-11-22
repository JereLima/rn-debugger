import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JSONTree } from "react-json-tree";
import { ChevronDown, RotateCw } from "lucide-react";
import type { StorageEntry } from "../store";
import { useStore } from "../store";
import { sendToDevice } from "../bridge";

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

const KIND_STYLE: Record<string, string> = {
  string: "bg-sky-600/80 text-sky-50",
  number: "bg-violet-600/80 text-violet-50",
  boolean: "bg-emerald-600/80 text-emerald-50",
  info: "bg-zinc-700 text-zinc-300",
  unknown: "bg-zinc-700 text-zinc-300",
};

const OP_STYLE: Record<string, string> = {
  write: "text-emerald-400",
  delete: "text-red-400",
  read: "text-zinc-500",
  clear: "text-amber-300",
};

function tryParseJson(v: unknown): { ok: boolean; value?: unknown } {
  if (typeof v !== "string") return { ok: false };
  try {
    const parsed = JSON.parse(v);
    if (typeof parsed === "object" && parsed !== null) return { ok: true, value: parsed };
  } catch { /* não é JSON */ }
  return { ok: false };
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function EntryRow({ entry, changed }: { entry: StorageEntry; changed: boolean }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => tryParseJson(entry.value), [entry.value]);
  const raw = String(entry.value ?? "");
  const short = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;

  return (
    <div className={`border-b border-zinc-800/60 ${changed ? "bg-amber-400/10" : ""}`}>
      <button
        onClick={() => parsed.ok && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-3 py-1.5 text-left ${parsed.ok ? "cursor-pointer hover:bg-zinc-800/50" : "cursor-default"}`}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{entry.key}</span>
        {parsed.ok && <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">JSON</span>}
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${KIND_STYLE[entry.kind] ?? KIND_STYLE.unknown}`}>
          {entry.kind}
        </span>
        <span className="min-w-0 flex-[2] truncate font-mono text-xs text-zinc-400">{short || "(vazio)"}</span>
      </button>
      {open && parsed.ok && (
        <div className="px-3 pb-2 pl-6" onClick={(e) => e.stopPropagation()}>
          <JSONTree data={parsed.value} hideRoot theme={JSON_THEME} invertTheme={false}
            shouldExpandNodeInitially={() => false} />
        </div>
      )}
      {open && !parsed.ok && (
        <pre className="whitespace-pre-wrap break-all px-3 pb-2 pl-6 font-mono text-xs text-zinc-300">{raw}</pre>
      )}
    </div>
  );
}

export function StorageTab() {
  const storages = useStore((s) => s.storages);
  const storageEvents = useStore((s) => s.storageEvents);
  const selectedStorage = useStore((s) => s.selectedStorage);
  const selectStorage = useStore((s) => s.selectStorage);
  const clearStorageEvents = useStore((s) => s.clearStorageEvents);

  const [query, setQuery] = useState("");
  const [showReads, setShowReads] = useState(false);
  const [feedOpen, setFeedOpen] = useState(true);

  const names = useMemo(() => Object.keys(storages).sort(), [storages]);
  const active = selectedStorage && storages[selectedStorage] ? selectedStorage : (names[0] ?? null);
  const data = active ? storages[active] : null;

  const prevMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of data?.previous ?? []) {
      try { m.set(e.key, JSON.stringify(e.value)); } catch { m.set(e.key, String(e.value)); }
    }
    return m;
  }, [data]);

  const changedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.entries ?? []) {
      let cur: string;
      try { cur = JSON.stringify(e.value); } catch { cur = String(e.value); }
      if (prevMap.get(e.key) !== cur) set.add(e.key);
    }
    return set;
  }, [data, prevMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.entries ?? []).filter((e) => {
      if (!q) return true;
      try {
        return e.key.toLowerCase().includes(q) || String(e.value ?? "").toLowerCase().includes(q);
      } catch { return false; }
    });
  }, [data, query]);

  const feed = useMemo(() => {
    const list = showReads ? storageEvents : storageEvents.filter((e) => e.op !== "read");
    return list.slice(-50);
  }, [storageEvents, showReads]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  async function refresh() {
    if (!active) return;
    try {
      await sendToDevice({ v: 1, type: "storage.get", storage: active });
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-full">
      <div className="flex w-56 shrink-0 flex-col gap-1 overflow-auto border-r border-zinc-800 bg-zinc-900 p-3">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Storages ({names.length})
        </p>
        {names.length === 0 ? (
          <p className="px-1 text-xs text-zinc-600">Nenhum storage — use debugAsyncStorage() no app.</p>
        ) : (
          names.map((n) => (
            <button
              key={n}
              onClick={() => selectStorage(n)}
              className={`rounded px-2 py-1.5 text-left text-xs ${
                active === n ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60"
              }`}
            >
              <div className="truncate font-mono">{n}</div>
              <div className="font-mono text-[10px] text-zinc-500">{storages[n].entries.length} chaves</div>
            </button>
          ))
        )}
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por chave/valor…"
            className="w-56 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <button
            onClick={() => setShowReads((v) => !v)}
            className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${showReads ? "bg-zinc-600 text-zinc-100" : "bg-zinc-800 text-zinc-500"}`}
          >
            reads
          </button>
          <button
            onClick={clearStorageEvents}
            className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            Limpar feed
          </button>
          <button
            onClick={refresh}
            disabled={!active}
            className="ml-auto flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            title="Pedir re-snapshot ao device"
          >
            <RotateCw size={13} /> Refresh
          </button>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          {!data ? (
            <p className="p-4 text-xs text-zinc-500">Aguardando snapshots de storage…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-zinc-500">Nenhuma chave corresponde ao filtro.</p>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((v) => {
                const e = filtered[v.index];
                return (
                  <div
                    key={e.key}
                    style={{
                      position: "absolute", top: 0, left: 0, width: "100%",
                      transform: `translateY(${v.start}px)`,
                    }}
                    ref={virtualizer.measureElement}
                    data-index={v.index}
                  >
                    <EntryRow entry={e} changed={changedKeys.has(e.key)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setFeedOpen((o) => !o)}
            className="flex w-full items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            <ChevronDown size={12} className={feedOpen ? "" : "-rotate-90"} />
            Eventos ({storageEvents.length})
          </button>
          {feedOpen && (
            <div className="h-40 overflow-auto px-3 pb-2 font-mono text-xs">
              {feed.length === 0 ? (
                <p className="text-zinc-600">sem eventos</p>
              ) : (
                feed.map((e) => (
                  <div key={e.id} className="truncate py-0.5">
                    <span className="text-zinc-500">{formatTs(e.ts)}</span>{" "}
                    <span className={`font-bold ${OP_STYLE[e.op]}`}>[{e.op}]</span>{" "}
                    <span className="text-zinc-400">{e.storage}{e.key ? ` ${e.key}` : ""}</span>
                    {e.value !== undefined && (
                      <span className="text-zinc-500"> = {String(e.value).slice(0, 80)}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
