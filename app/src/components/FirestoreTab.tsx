import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Play, RotateCcw as RotateCw } from "lucide-react";
import type { FsOpEvent } from "../store";
import { useStore } from "../store";
import { sendToDevice } from "../bridge";

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

function OpRow({
  e, open, onToggle, onUsePath,
}: { e: FsOpEvent; open: boolean; onToggle: () => void; onUsePath?: () => void }) {
  let dataPreview: string | null = null;
  if (open) {
    if (e.data === undefined || e.data === null) dataPreview = null;
    else {
      try { dataPreview = JSON.stringify(e.data, null, 2); } catch { dataPreview = String(e.data); }
    }
  }
  return (
    <div className="border-b border-zinc-800/60">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") onToggle(); }}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left hover:bg-zinc-800/40"
      >
        <span className="shrink-0 font-mono text-xs text-zinc-500">{formatTs(e.ts)}</span>
        <span className={`w-14 shrink-0 font-mono text-[11px] font-bold uppercase ${OP_STYLE[e.op] ?? OP_STYLE.read}`}>
          {e.op}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">{e.path}</span>
        {e.n > 1 && (
          <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">×{e.n}</span>
        )}
        {e.detail && <span className="shrink-0 font-mono text-[10px] text-zinc-500">{e.detail}</span>}
        {onUsePath && (
          <button
            type="button"
            title="Usar este path no composer"
            className="shrink-0 rounded px-1 font-mono text-[11px] text-zinc-600 hover:text-sky-400"
            onClick={(ev) => { ev.stopPropagation(); onUsePath(); }}
          >
            ↥
          </button>
        )}
        {e.data !== undefined && (
          <span className="shrink-0 font-mono text-[10px] text-sky-500">{open ? "▾" : "▸"}</span>
        )}
      </div>
      {open && (
        <div className="px-3 pb-2">
          {dataPreview === null ? (
            <p className="font-mono text-[11px] text-zinc-500">sem payload capturado</p>
          ) : (
            <pre className="max-h-56 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
              {dataPreview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function FirestoreTab() {
  const fs = useStore((s) => s.fs);
  const resetFsSession = useStore((s) => s.resetFsSession);
  const fsRun = useStore((s) => s.fsRun);
  const fsRunSubmit = useStore((s) => s.fsRunSubmit);
  const [query, setQuery] = useState("");
  const [opsOff, setOpsOff] = useState<Record<string, boolean>>({});
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({});

  // composer "executar no device"
  const [composerOpen, setComposerOpen] = useState(false);
  const [runOp, setRunOp] = useState<"add" | "set" | "update" | "delete">("add");
  const [runPath, setRunPath] = useState("tasks");
  const [runJson, setRunJson] = useState('{\n  "text": "tarefa criada do desktop",\n  "done": false\n}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [runTimeout, setRunTimeout] = useState(false);

  useEffect(() => {
    setRunTimeout(false);
    if (!fsRun.pending) return;
    const t = setTimeout(() => setRunTimeout(true), 6000);
    return () => clearTimeout(t);
  }, [fsRun.pending, fsRun.reqId]);

  const byColl = useMemo(() => {
    const map = new Map<string, { r: number; w: number; d: number }>();
    for (const e of fs.events) {
      const coll = (e.path.split("/")[0] || "?").toLowerCase();
      const cur = map.get(coll) ?? { r: 0, w: 0, d: 0 };
      if (e.op === "read") cur.r += e.n;
      else if (e.op === "write") cur.w += e.n;
      else cur.d += e.n;
      map.set(coll, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].r + b[1].w + b[1].d - (a[1].r + a[1].w + a[1].d))
      .slice(0, 8);
  }, [fs.events]);

  const runCommand = () => {
    const text = runJson.trim();
    let data: unknown = {};
    if (text && runOp !== "delete") {
      try {
        data = JSON.parse(text);
        setJsonError(null);
      } catch (e) {
        setJsonError(`JSON inválido: ${String(e)}`);
        return;
      }
    }
    if (!runPath.trim()) {
      setJsonError("path obrigatório — coleção (add) ou col/docId (set/update/delete)");
      return;
    }
    const reqId = crypto.randomUUID();
    fsRunSubmit(reqId);
    void sendToDevice({ type: "fs.run", op: runOp, path: runPath.trim(), data, reqId });
  };

  const usePath = (path: string) => {
    const seg = path.split("/").filter(Boolean);
    setRunPath(seg.length >= 2 ? `${seg[0]}/${seg[1]}` : (seg[0] ?? ""));
    setComposerOpen(true);
  };

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

      {byColl.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 px-3 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">coleções</span>
          {byColl.map(([coll, c]) => (
            <button
              key={coll}
              onClick={() => setQuery(query.trim().toLowerCase() === coll ? "" : coll)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                query.trim().toLowerCase() === coll
                  ? "bg-sky-900/60 text-sky-200"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {coll}
              {c.r > 0 && <span className="text-sky-400"> {c.r}r</span>}
              {c.w > 0 && <span className="text-emerald-400"> {c.w}w</span>}
              {c.d > 0 && <span className="text-red-400"> {c.d}d</span>}
            </button>
          ))}
        </div>
      )}

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
          onClick={() => setComposerOpen((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs ${
            composerOpen ? "bg-sky-800 text-sky-100" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          title="Executar uma op de Firestore direto no device"
        >
          <Play size={13} /> Device
        </button>
        <button
          onClick={resetFsSession}
          className="ml-auto flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          title="Zerar contadores da sessão"
        >
          <RotateCw size={13} /> Reiniciar sessão
        </button>
      </div>

      {composerOpen && (
        <div className="flex flex-col gap-2 border-b border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center gap-2">
            <select
              value={runOp}
              onChange={(e) => setRunOp(e.target.value as typeof runOp)}
              className="rounded-md bg-zinc-800 px-2 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              <option value="add">add</option>
              <option value="set">set</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
            </select>
            <input
              value={runPath}
              onChange={(e) => setRunPath(e.target.value)}
              placeholder="tasks (add) ou tasks/abc123 (set/update/delete)"
              className="flex-1 rounded-md bg-zinc-800 px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              onClick={runCommand}
              className="flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-600"
            >
              <Play size={12} /> Executar
            </button>
          </div>
          {runOp !== "delete" && (
            <textarea
              value={runJson}
              onChange={(e) => { setRunJson(e.target.value); setJsonError(null); }}
              rows={5}
              spellCheck={false}
              placeholder='{"text": "nova tarefa", "done": false}'
              className="w-full resize-y rounded-md bg-zinc-800 px-2.5 py-1.5 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          )}
          {jsonError && <p className="font-mono text-[11px] text-red-400">✖ {jsonError}</p>}
          {fsRun.pending && (
            <p className="font-mono text-[11px] text-zinc-400">
              aguardando device…
              {runTimeout ? " sem resposta — device conectado? Firestore configurado neste build?" : ""}
            </p>
          )}
          {!fsRun.pending && fsRun.last && (
            <p className={`font-mono text-[11px] ${fsRun.last.ok ? "text-emerald-400" : "text-red-400"}`}>
              {fsRun.last.ok ? "✔" : "✖"} {fsRun.last.text}
            </p>
          )}
          <p className="font-mono text-[10px] text-zinc-500">
            add → nova id gerada · set → sobrescreve o doc · update → merge de campos · delete → remove. A op aparece no feed abaixo como se fosse do app.
          </p>
        </div>
      )}

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
                  <OpRow
                    e={e}
                    open={!!openIds[e.id]}
                    onToggle={() => setOpenIds((d) => ({ ...d, [e.id]: !d[e.id] }))}
                    onUsePath={() => usePath(e.path)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
