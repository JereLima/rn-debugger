const MAX_KEYS = 500;
const MAX_VALUE = 8_000;

type Send = (msg: object) => void;
export interface StorageEntry { key: string; kind: string; value: unknown }

function capValue(v: unknown): unknown {
  if (typeof v === "string" && v.length > MAX_VALUE) {
    return `${v.slice(0, MAX_VALUE)}… (${v.length} chars)`;
  }
  return v;
}

function makeSnapshotScheduler(snapshot: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; snapshot(); }, 800);
  };
}

/** Patch + snapshot de AsyncStorage. Retorna a função de refresh sob demanda. */
export function patchAsyncStorage(send: Send, AsyncStorage: any): () => void {
  const name = "async-storage";
  if (!AsyncStorage || typeof AsyncStorage.setItem !== "function") return () => {};

  async function snapshot() {
    try {
      const keys: string[] = (await AsyncStorage.getAllKeys()) ?? [];
      const entries: StorageEntry[] = [];
      const pairs = keys.length
        ? ((await AsyncStorage.multiGet(keys.slice(0, MAX_KEYS))) as [string, string | null][])
        : [];
      for (const [k, v] of pairs) entries.push({ key: k, kind: "string", value: capValue(v) });
      if (keys.length > MAX_KEYS) {
        entries.push({ key: `… +${keys.length - MAX_KEYS} keys`, kind: "info", value: null });
      }
      send({ v: 1, type: "storage.snapshot", ts: Date.now(), storage: name, entries });
    } catch { /* storage indisponível: ignora */ }
  }

  const scheduleSnapshot = makeSnapshotScheduler(() => { void snapshot(); });

  const origSetItem = AsyncStorage.setItem.bind(AsyncStorage);
  AsyncStorage.setItem = async (key: string, value: string) => {
    send({ v: 1, type: "storage.write", ts: Date.now(), storage: name, key: String(key), kind: "string", value: capValue(value) });
    scheduleSnapshot();
    return origSetItem(key, value);
  };

  const origMultiSet = AsyncStorage.multiSet?.bind(AsyncStorage);
  if (origMultiSet) {
    AsyncStorage.multiSet = async (pairs: [string, string][]) => {
      for (const [k, v] of pairs ?? []) {
        send({ v: 1, type: "storage.write", ts: Date.now(), storage: name, key: String(k), kind: "string", value: capValue(v) });
      }
      scheduleSnapshot();
      return origMultiSet(pairs);
    };
  }

  const origRemove = AsyncStorage.removeItem.bind(AsyncStorage);
  AsyncStorage.removeItem = async (key: string) => {
    send({ v: 1, type: "storage.delete", ts: Date.now(), storage: name, key: String(key) });
    scheduleSnapshot();
    return origRemove(key);
  };

  const origMultiRemove = AsyncStorage.multiRemove?.bind(AsyncStorage);
  if (origMultiRemove) {
    AsyncStorage.multiRemove = async (keys: string[]) => {
      for (const k of keys ?? []) {
        send({ v: 1, type: "storage.delete", ts: Date.now(), storage: name, key: String(k) });
      }
      scheduleSnapshot();
      return origMultiRemove(keys);
    };
  }

  for (const clearName of ["clearAll", "clear"]) {
    const orig = AsyncStorage[clearName]?.bind(AsyncStorage);
    if (!orig) continue;
    AsyncStorage[clearName] = async () => {
      send({ v: 1, type: "storage.clear", ts: Date.now(), storage: name });
      scheduleSnapshot();
      return orig();
    };
  }

  // Reads também viram eventos (útil para depurar hidratação) — sem re-snapshot.
  const origGetItem = AsyncStorage.getItem.bind(AsyncStorage);
  AsyncStorage.getItem = async (key: string) => {
    const result = await origGetItem(key);
    send({ v: 1, type: "storage.read", ts: Date.now(), storage: name, key: String(key), kind: "string", value: capValue(result) });
    return result;
  };

  void snapshot();
  return () => { void snapshot(); };
}

/** Patch + snapshot de instância MMKV. Retorna a função de refresh sob demanda. */
export function patchMMKV(send: Send, instance: any, name = "mmkv"): () => void {
  const id = `mmkv:${name}`;
  if (!instance || typeof instance.getAllKeys !== "function") return () => {};

  function readEntry(key: string): StorageEntry {
    try {
      const s = instance.getString?.(key);
      if (s !== undefined && s !== null) return { key, kind: "string", value: capValue(s) };
      const n = instance.getNumber?.(key);
      if (n !== undefined && n !== null) return { key, kind: "number", value: n };
      const b = instance.getBoolean?.(key);
      if (b !== undefined && b !== null) return { key, kind: "boolean", value: b };
    } catch { /* ignore */ }
    return { key, kind: "unknown", value: "[buffer ou tipo não suportado]" };
  }

  function snapshot() {
    try {
      const keys: string[] = (instance.getAllKeys() ?? []).map(String);
      const entries = keys.slice(0, MAX_KEYS).map(readEntry);
      if (keys.length > MAX_KEYS) {
        entries.push({ key: `… +${keys.length - MAX_KEYS} keys`, kind: "info", value: null });
      }
      send({ v: 1, type: "storage.snapshot", ts: Date.now(), storage: id, entries });
    } catch { /* ignore */ }
  }

  const scheduleSnapshot = makeSnapshotScheduler(snapshot);

  // Patch best-effort — se a instância não permitir override (frozen/proxy),
  // degrada para "snapshot só via botão refresh" sem quebrar o app.
  // MMKV NÃO tem patch de reads: getString etc. são chamados a cada render (ruído alto).
  try {
    const origSet = instance.set.bind(instance);
    instance.set = (key: unknown, value: unknown) => {
      const result = origSet(key, value);
      send({ v: 1, type: "storage.write", ts: Date.now(), storage: id, key: String(key), kind: typeof value, value: capValue(value) });
      scheduleSnapshot();
      return result;
    };
    const origDelete = instance.delete.bind(instance);
    instance.delete = (key: unknown) => {
      const result = origDelete(key);
      send({ v: 1, type: "storage.delete", ts: Date.now(), storage: id, key: String(key) });
      scheduleSnapshot();
      return result;
    };
    const origClear = instance.clearAll?.bind(instance);
    if (origClear) {
      instance.clearAll = () => {
        const result = origClear();
        send({ v: 1, type: "storage.clear", ts: Date.now(), storage: id });
        scheduleSnapshot();
        return result;
      };
    }
  } catch { /* snapshot-only */ }

  snapshot();
  return snapshot;
}
