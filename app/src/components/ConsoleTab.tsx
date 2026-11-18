import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JSONTree } from "react-json-tree";
import type { LogEntry } from "../store";
import { useStore } from "../store";

const LEVELS = ["log", "info", "warn", "error", "debug"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_STYLE: Record<Level, string> = {
  log: "bg-zinc-700 text-zinc-200",
  info: "bg-sky-600/80 text-sky-50",
  warn: "bg-amber-500/90 text-amber-950",
  error: "bg-red-600/90 text-red-50",
  debug: "bg-violet-600/80 text-violet-50",
};

const JSON_THEME = {
  scheme: "devbridge",
  base00: "transparent",
  base01: "#3f3f46",
  base02: "#52525b",
  base03: "#71717a",
  base04: "#a1a1aa",
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

function formatTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function isErrorLike(v: unknown): v is { __error: true; name: string; message: string; stack: string } {
  return (
    typeof v === "object" && v !== null &&
    (v as any).__error === true
  );
}

function ArgView({ value }: { value: unknown }) {
  if (value === null) return <span className="text-zinc-500">null</span>;
  if (value === undefined) return <span className="text-zinc-500">undefined</span>;
  if (typeof value === "string") return <span className="text-emerald-300">"{value}"</span>;
  if (typeof value === "number") return <span className="text-sky-300">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-violet-300">{String(value)}</span>;
  if (isErrorLike(value)) {
    return (
      <pre className="whitespace-pre-wrap break-all text-xs text-red-300">
        {value.name}: {value.message}
        {value.stack ? `\n${value.stack}` : ""}
      </pre>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        <JSONTree
          data={value}
          hideRoot
          theme={JSON_THEME}
          invertTheme={false}
          shouldExpandNodeInitially={() => false}
        />
      </div>
    );
  }
  return <span className="text-zinc-300">{String(value)}</span>;
}

function LogRow({ entry }: { entry: LogEntry }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.args, null, 2));
    } catch { /* ignore */ }
  }

  return (
    <div
      onClick={copy}
      title="Clique para copiar"
      className="flex cursor-pointer gap-3 border-b border-zinc-800/60 px-3 py-1.5 hover:bg-zinc-800/50"
    >
      <span className="shrink-0 font-mono text-xs text-zinc-500">{formatTs(entry.ts)}</span>
      <span
        className={`h-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.log}`}
      >
        {entry.level}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs">
        {entry.args.length === 0 ? (
          <span className="text-zinc-600">(sem argumentos)</span>
        ) : (
          entry.args.map((a, i) => <ArgView key={i} value={a} />)
        )}
      </div>
    </div>
  );
}

export function ConsoleTab() {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);
  const [query, setQuery] = useState("");
  const [disabled, setDisabled] = useState<Record<Level, boolean>>({
    log: false, info: false, warn: false, error: false, debug: false,
  });

  const counts = useMemo(() => {
    const c: Record<Level, number> = { log: 0, info: 0, warn: 0, error: 0, debug: 0 };
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (disabled[l.level]) return false;
      if (!q) return true;
      try {
        return JSON.stringify(l.args).toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [logs, query, disabled]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  function toggleLevel(lv: Level) {
    setDisabled((d) => ({ ...d, [lv]: !d[lv] }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar logs…"
          className="w-56 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
        <div className="flex gap-1">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => toggleLevel(lv)}
              className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                disabled[lv] ? "bg-zinc-800 text-zinc-600 line-through" : LEVEL_STYLE[lv]
              }`}
            >
              {lv} {counts[lv]}
            </button>
          ))}
        </div>
        <button
          onClick={clearLogs}
          className="ml-auto rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Limpar
        </button>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-zinc-500">
            {logs.length === 0 ? "Nenhum log ainda — rode o app com addDebug()." : "Nenhum log corresponde ao filtro."}
          </p>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const entry = filtered[v.index];
              return (
                <div
                  key={entry.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                >
                  <LogRow entry={entry} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
