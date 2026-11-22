import { useMemo, useState } from "react";
import { JSONTree } from "react-json-tree";
import { useStore } from "../store";
import { diffPaths } from "../diff";

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

// react-json-tree passa keyPath como [chaveAtual, ...ancestrais]; invertemos
// para comparar com os caminhos do diffPaths ("a.b.c").
function pathOf(keyPath: readonly (string | number)[]): string {
  return [...keyPath].reverse().join(".");
}

const HIGHLIGHT = { background: "rgba(250,204,21,0.15)", borderRadius: 2 };

export function StateTab() {
  const states = useStore((s) => s.states);
  const names = useMemo(() => Object.keys(states).sort(), [states]);
  const [selected, setSelected] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);

  const active = selected && states[selected] ? selected : (names[0] ?? null);
  const snap = active ? states[active] : null;
  const changed = useMemo(
    () => (snap ? diffPaths(snap.previous, snap.current) : new Set<string>()),
    [snap],
  );

  return (
    <div className="flex h-full">
      <div className="w-60 shrink-0 overflow-auto border-r border-zinc-800 bg-zinc-900 p-2">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Subscriptions ({names.length})
        </p>
        {names.length === 0 ? (
          <p className="px-1 text-xs text-zinc-600">Nenhuma subscription — use debugZustand() no app.</p>
        ) : (
          names.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                active === n ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60"
              }`}
            >
              <span className="truncate font-mono">{n}</span>
              <span className="ml-2 shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                {states[n].count}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-800 p-2">
          <span className="font-mono text-xs text-zinc-400">
            {snap ? `atualizado ${new Date(snap.ts).toLocaleTimeString()} · ${changed.size} caminho(s) alterado(s)` : "selecione uma subscription"}
          </span>
          <button
            onClick={() => setRaw((r) => !r)}
            className="ml-auto rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            {raw ? "ver árvore" : "ver raw"}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 font-mono text-xs">
          {!snap ? (
            <p className="text-xs text-zinc-500">Aguardando snapshots de state…</p>
          ) : raw ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">previous</h4>
                <pre className="whitespace-pre-wrap break-all text-zinc-400">{JSON.stringify(snap.previous, null, 2)}</pre>
              </div>
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">current</h4>
                <pre className="whitespace-pre-wrap break-all text-zinc-200">{JSON.stringify(snap.current, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <JSONTree
              data={snap.current ?? null}
              hideRoot
              theme={JSON_THEME}
              invertTheme={false}
              shouldExpandNodeInitially={() => true}
              labelRenderer={(keyPath: readonly (string | number)[], _nodeType: string, _expanded: boolean, _expandable: boolean) => (
                <span style={changed.has(pathOf(keyPath)) ? HIGHLIGHT : undefined}>{String(keyPath[0])}</span>
              )}
              valueRenderer={(display: unknown, _value: unknown, ...keyPath: readonly (string | number)[]) => (
                <span style={changed.has(pathOf(keyPath)) ? HIGHLIGHT : undefined}>{String(display)}</span>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
