import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RotateCcw as RotateCw } from "lucide-react";
import type { FsOpEvent } from "../store";
import { useStore } from "../store";

const OPS = ["read", "write", "delete"] as const;
type FsOp = (typeof OPS)[number];

const OP_STYLE: Record<FsOp, string> = {
  read: "text-sky-400",
  write: "text-emerald-400",
  delete: "text-red-400",
};

const CARD_COLOR: Record<FsOp, string> = {
  read: "text-sky-400",
  write: "text-emerald-400",
  delete: "text-red-400",
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 rounded-lg bg-zinc-800/80 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${color}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function OpRow({ e }: { e: FsOpEvent }) {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-800/60 px-3 py-1.5">
      <span className="shrink-0 font-mono text-xs text-zinc-500">{formatTs(e.ts)}</span>
      <span className={`w-14 shrink-0 font-mono text-[11px] font-bold uppercase ${OP_STYLE[e.op] ?? OP_STYLE.read}`}>
        {e.op}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">{e.path}</span>
      {e.n > 1 && (
        <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">×{e.n}</span>
      )}
      {e.detail && <span className="shrink-0 font-mono text-[10px] text-zinc-500">{e.detail}</span>}
    </div>
  );
}

export function FirestoreTab() {
  const fs = useStore((s) => s.fs);
  const resetFsSession = useStore((s) => s.resetFsSession);
  const [query, setQuery] = useState("");
  const [opsOff, setOpsOff] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fs.events.filter((e) => {
      if (opsOff[e.op]) return false;
      if (!q) return true;
      try {
        return e.path.toLowerCase().includes(q) || (e.detail ?? "").toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [fs.events, query, opsOff]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 10,
  });

  const mins = Math.max(1, Math.round((Date.now() - fs.startedAt) / 60000));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 p-3">
        <Card label="reads" value={fs.reads} color={CARD_COLOR.read} />
        <Card label="writes" value={fs.writes} color={CARD_COLOR.write} />
        <Card label="deletes" value={fs.deletes} color={CARD_COLOR.delete} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por coleção/op…"
          className="w-56 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
        <div className="flex gap-1">
          {OPS.map((op) => (
            <button
              key={op}
              onClick={() => setOpsOff((d) => ({ ...d, [op]: !d[op] }))}
              className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                opsOff[op] ? "bg-zinc-800 text-zinc-600 line-through" : `bg-zinc-700 ${OP_STYLE[op]}`
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-zinc-500">sessão: ~{mins} min</span>
        <button
          onClick={resetFsSession}
          className="ml-auto flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          title="Zerar contadores da sessão"
        >
          <RotateCw size={13} /> Reiniciar sessão
        </button>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-zinc-500">
            {fs.events.length === 0
              ? "Nenhuma op ainda — use o app (debugFirestore instrumenta getDocs/setDoc/onSnapshot/...)."
              : "Nenhuma op corresponde ao filtro."}
          </p>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const e = filtered[v.index];
              return (
                <div
                  key={e.id}
                  style={{
                    position: "absolute", top: 0, left: 0, width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                >
                  <OpRow e={e} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
