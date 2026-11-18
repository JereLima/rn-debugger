import { useEffect, useState } from "react";
import { initBridge } from "./bridge";
import { Sidebar, type TabId } from "./components/Sidebar";
import { ConsoleTab } from "./components/ConsoleTab";
import { NetworkTab } from "./components/NetworkTab";

export default function App() {
  const [tab, setTab] = useState<TabId>("console");

  useEffect(() => {
    initBridge();
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar active={tab} onSelect={setTab} />
      <main className="min-w-0 flex-1">
        {tab === "console" && <ConsoleTab />}
        {tab === "network" && <NetworkTab />}
      </main>
    </div>
  );
}
