import { TerminalSquare, Globe, Database, HardDrive, Bug, Flame } from "lucide-react";
import { useStore } from "../store";
import { StatusCard } from "./StatusCard";

export type TabId = "console" | "network" | "state" | "storage" | "firestore" | "devtools";

const TABS: { id: TabId; label: string; icon: any; enabled: boolean }[] = [
  { id: "console", label: "Console", icon: TerminalSquare, enabled: true },
  { id: "network", label: "Network", icon: Globe, enabled: true },
  { id: "state", label: "State", icon: Database, enabled: true },
  { id: "storage", label: "Storage", icon: HardDrive, enabled: true },
  { id: "firestore", label: "Firestore", icon: Flame, enabled: true },
  { id: "devtools", label: "React DevTools", icon: Bug, enabled: true },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (t: TabId) => void;
}) {
  const clients = useStore((s) => s.clients);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-3 border-r border-zinc-800 bg-zinc-900 p-3">
      <h1 className="px-1 text-sm font-bold tracking-wide text-zinc-100">rn-debugger</h1>

      <StatusCard />

      <div className="flex flex-col gap-1">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Devices ({Object.keys(clients).length})
        </p>
        {Object.values(clients).length === 0 ? (
          <p className="px-1 text-xs text-zinc-600">nenhum conectado</p>
        ) : (
          Object.values(clients).map((c) => (
            <div key={c.clientId} className="rounded bg-zinc-800/60 px-2 py-1.5 text-xs">
              <div className="font-medium text-zinc-200">
                {(c.hello?.device?.deviceName as string) ||
                  (c.hello?.device?.platform as string) ||
                  "device"}
              </div>
              <div className="font-mono text-[10px] text-zinc-500">
                {c.hello?.device?.platform ?? "?"} ·{" "}
                {new Date(c.connectedAt).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              disabled={!t.enabled}
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : t.enabled
                    ? "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                    : "cursor-not-allowed text-zinc-600"
              }`}
            >
              <Icon size={15} />
              <span className="flex-1">{t.label}</span>
              {!t.enabled && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-500">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
