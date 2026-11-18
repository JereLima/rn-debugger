import { useEffect, useState } from "react";
import { initBridge } from "./bridge";
import { Sidebar, type TabId } from "./components/Sidebar";
import { ConsoleTab } from "./components/ConsoleTab";
import { NetworkTab } from "./components/NetworkTab";
import { StateTab } from "./components/StateTab";
import { StorageTab } from "./components/StorageTab";
import { DevToolsTab } from "./components/DevToolsTab";

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
        {tab === "state" && <StateTab />}
        {tab === "storage" && <StorageTab />}
        {tab === "devtools" && <DevToolsTab />}
      </main>
    </div>
  );
}
