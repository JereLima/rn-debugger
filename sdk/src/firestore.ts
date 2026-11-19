// M6 — Firestore inspector.
// Captura ops do Firestore na camada de API modular (getDocs/setDoc/onSnapshot/...)
// e emite: fs.op (contadores desktop), network.req/res sintéticas (NetworkTab,
// url firestore://<path>) e console.log "[fs] ...".
//
// Regras de cobrança do Firestore (documentadas):
// - query/getDocs: 1 read por doc retornado; getDoc: 1 se exists.
// - listener: inicial = docs entregues; updates: apenas added+modified (removed não cobra).
// - setDoc/updateDoc/addDoc: 1 write; deleteDoc: 1 delete; batch/transaction somam no commit.
// - leituras de cache (getDocFromCache etc.): 0 reads.

type Send = (msg: object) => void;

export interface FirestoreDebugOptions {
  /** Logar cada op no console do device (default true). */
  log?: boolean;
}

let seq = 0;
const nextId = () => `fs_${++seq}`;

const MAX_LABEL = 120;

function labelOf(ref: any): string {
  try {
    if (typeof ref === "string") return ref.slice(0, MAX_LABEL);
    const p = ref?.__dbPath ?? ref?.path;
    if (typeof p === "string" && p) return p.slice(0, MAX_LABEL);
  } catch { /* ignore */ }
  return "query";
}

/** Patch do módulo Firestore (API modular — RNFB v26+ e JS SDK).
 *  Idempotente: api.__dbFirestore marca módulos já instrumentados. */
export function patchFirestore(
  send: Send,
  api: any,
  _db: any,
  options: FirestoreDebugOptions = {},
): void {
  if (!api || (api as any).__dbFirestore) return;
  (api as any).__dbFirestore = true;
  const shouldLog = options.log !== false;

  const emit = (op: "read" | "write" | "delete", n: number, path: string, fn: string) => {
    try {
      send({ v: 1, type: "fs.op", ts: Date.now(), op, n, path, detail: fn });
    } catch { /* nunca quebrar o app do usuário */ }
    if (shouldLog) {
      try {
        const tag = op === "delete" ? "warn" : "log";
        (console as any)[tag](`[fs] ${op} ${path}${n !== 1 ? ` ×${n}` : ""} (${fn})`);
      } catch { /* ignore */ }
    }
  };

  const netReq = (id: string, op: "read" | "write" | "delete", path: string, fn: string) => {
    try {
      send({
        v: 1, type: "network.req", id, ts: Date.now(),
        method: op.toUpperCase(), url: `firestore://${path}`, headers: {}, body: fn,
      });
    } catch { /* ignore */ }
  };
  const netRes = (id: string, path: string, duration: number, note?: string, status = 200) => {
    try {
      send({
        v: 1, type: "network.res", id, ts: Date.now(),
        status, url: `firestore://${path}`, duration, headers: {}, body: note,
      });
    } catch { /* ignore */ }
  };

  const set = (name: string, impl: (this: any, ...args: any[]) => unknown) => {
    const orig = (api as any)[name];
    if (typeof orig !== "function") return;
    (impl as any).__dbOrig = orig;
    try {
      (api as any)[name] = impl;
    } catch { /* módulo selado: pula silenciosamente */ }
  };

  const t0Of = () => Date.now();

  // ---------- refs/queries: propagar labels de path ----------
  for (const name of ["collection", "doc", "collectionGroup"]) {
    const orig = (api as any)[name];
    if (typeof orig !== "function") continue;
    set(name, function (db2: any, ...rest: any[]) {
      const ref = orig(db2, ...rest);
      try {
        if (ref && typeof ref === "object" && typeof ref.path === "string") {
          (ref as any).__dbPath = ref.path;
        }
      } catch { /* ignore */ }
      return ref;
    });
  }
  // query builders: cada um recebe a ref/query como 1º arg e devolve nova query —
  // herdamos o __dbPath para o resultado.
  const QB = ["query", "where", "orderBy", "limit", "limitToLast", "startAt",
    "startAfter", "endAt", "endBefore", "withConverter"];
  for (const name of QB) {
    const orig = (api as any)[name];
    if (typeof orig !== "function") continue;
    set(name, function (first: any, ...rest: any[]) {
      const out = orig(first, ...rest);
      try {
        if (out && typeof out === "object") {
          const src = first?.__dbPath ?? first?.path;
          if (typeof src === "string" && src) (out as any).__dbPath = src;
        }
      } catch { /* ignore */ }
      return out;
    });
  }

  // ---------- reads ----------
  const wrapRead = (name: string, count: (snap: any) => number, note: (snap: any) => string) => {
    const orig = (api as any)[name];
    if (typeof orig !== "function") return;
    set(name, async function (ref: any, ...rest: any[]) {
      const id = nextId(), t0 = t0Of(), path = labelOf(ref);
      netReq(id, "read", path, name);
      try {
        const snap = await orig(ref, ...rest);
        emit("read", count(snap), path, name);
        netRes(id, path, Date.now() - t0, note(snap));
        return snap;
      } catch (e) {
        netRes(id, path, Date.now() - t0, String(e), 0);
        throw e;
      }
    });
  };

  wrapRead(
    "getDocs",
    (snap) => (typeof snap?.size === "number" ? snap.size : Array.isArray(snap?.docs) ? snap.docs.length : Array.isArray(snap) ? snap.length : 0),
    (snap) => `${typeof snap?.size === "number" ? snap.size : "?"} docs`,
  );
  wrapRead(
    "getDoc",
    (snap) => { try { return typeof snap?.exists === "function" && snap.exists() ? 1 : 0; } catch { return 0; } },
    (snap) => { try { return snap?.exists?.() ? "1 doc" : "missing"; } catch { return "?"; } },
  );
  wrapRead(
    "getDocsFromServer",
    (snap) => (typeof snap?.size === "number" ? snap.size : 0),
    (snap) => `${typeof snap?.size === "number" ? snap.size : "?"} docs (server)`,
  );
  wrapRead(
    "getDocFromServer",
    (snap) => { try { return typeof snap?.exists === "function" && snap.exists() ? 1 : 0; } catch { return 0; } },
    () => "1 doc (server)",
  );
  // cache: não cobra reads — sem fs.op, só visibilidade.
  for (const name of ["getDocFromCache", "getDocsFromCache"]) {
    const orig = (api as any)[name];
    if (typeof orig !== "function") continue;
    set(name, async function (ref: any, ...rest: any[]) {
      const id = nextId(), t0 = t0Of(), path = labelOf(ref);
      netReq(id, "read", path, `${name} (cache)`);
      try {
        const snap = await orig(ref, ...rest);
        if (shouldLog) { try { console.log(`[fs] read ${path} ×0 (${name} cache — grátis)`); } catch { /* ignore */ } }
        netRes(id, path, Date.now() - t0, "cache (0 reads)");
        return snap;
      } catch (e) {
        netRes(id, path, Date.now() - t0, String(e), 0);
        throw e;
      }
    });
  }

  // ---------- writes ----------
  const wrapWrite = (name: string, op: "write" | "delete") => {
    const orig = (api as any)[name];
    if (typeof orig !== "function") return;
    set(name, async function (ref: any, ...rest: any[]) {
      const id = nextId(), t0 = t0Of(), path = labelOf(ref);
      netReq(id, op, path, name);
      try {
        const out = await orig(ref, ...rest);
        emit(op, 1, path, name);
        netRes(id, path, Date.now() - t0);
        return out;
      } catch (e) {
        netRes(id, path, Date.now() - t0, String(e), 0);
        throw e;
      }
    });
  };
  wrapWrite("setDoc", "write");
  wrapWrite("updateDoc", "write");
  wrapWrite("addDoc", "write");
  wrapWrite("deleteDoc", "delete");

  // ---------- onSnapshot ----------
  {
    const orig = (api as any).onSnapshot;
    if (typeof orig === "function") {
      set("onSnapshot", function (ref: any, ...args: any[]) {
        const path = labelOf(ref);
        const id = nextId();
        const t0 = t0Of();
        let firstEvent = true;

        const readsOf = (snap: any): number => {
          try {
            if (typeof snap?.size === "number") { // QuerySnapshot
              if (firstEvent) return snap.size;
              const ch = typeof snap.docChanges === "function" ? snap.docChanges() : [];
              return ch.filter((c: any) => c.type === "added" || c.type === "modified").length;
            }
            if (snap && typeof snap.exists === "function") { // DocumentSnapshot
              if (firstEvent) return snap.exists() ? 1 : 0;
              return 0; // updates de doc listener não cobram
            }
          } catch { /* ignore */ }
          return 0;
        };

        const wrapCb = (cb: (s: any) => unknown) => (snap: any) => {
          const n = readsOf(snap);
          if (firstEvent) { firstEvent = false; netRes(id, path, Date.now() - t0, "listener"); }
          if (n > 0) emit("read", n, path, "onSnapshot");
          return cb(snap);
        };

        try {
          const observerIdx = args.findIndex((a) => a && typeof a === "object" && typeof (a as any).next === "function");
          if (observerIdx >= 0) {
            const obs = { ...(args[observerIdx] as any) };
            obs.next = wrapCb(obs.next.bind(args[observerIdx]));
            args[observerIdx] = obs;
          } else {
            const cbIdx = args.findIndex((a) => typeof a === "function");
            if (cbIdx >= 0) args[cbIdx] = wrapCb(args[cbIdx]);
          }
        } catch { /* args fora do previsto: listener sem contagem */ }

        netReq(id, "read", path, "onSnapshot");
        return orig(ref, ...args);
      });
    }
  }

  // ---------- writeBatch ----------
  {
    const orig = (api as any).writeBatch;
    if (typeof orig === "function") {
      set("writeBatch", function (db2: any, ...rest: any[]) {
        const batch = orig(db2, ...rest);
        try {
          if (!batch || typeof batch.set !== "function" || (batch as any).__dbBatch) return batch;
          (batch as any).__dbBatch = true;
          let w = 0;
          let d = 0;
          const origSet = batch.set.bind(batch);
          batch.set = (r: any, ...a: any[]) => { w += 1; return origSet(r, ...a); };
          const origUpdate = batch.update?.bind(batch);
          if (origUpdate) batch.update = (r: any, ...a: any[]) => { w += 1; return origUpdate(r, ...a); };
          const origDelete = batch.delete?.bind(batch);
          if (origDelete) batch.delete = (r: any) => { d += 1; return origDelete(r); };
          const origCommit = batch.commit.bind(batch);
          batch.commit = async () => {
            const id = nextId(), t0 = t0Of();
            netReq(id, "write", "batch", "batch.commit");
            try {
              const out = await origCommit();
              if (w) emit("write", w, "batch", "batch");
              if (d) emit("delete", d, "batch", "batch");
              netRes(id, "batch", Date.now() - t0, `w=${w} d=${d}`);
              return out;
            } catch (e) {
              netRes(id, "batch", Date.now() - t0, String(e), 0);
              throw e;
            }
          };
        } catch { /* batch selado: sem instrumentação */ }
        return batch;
      });
    }
  }

  // ---------- runTransaction ----------
  {
    const orig = (api as any).runTransaction;
    if (typeof orig === "function") {
      set("runTransaction", function (db2: any, fn: (tx: any) => any, ...rest: any[]) {
        return orig(db2, function (tx: any) {
          try {
            if (!tx || (tx as any).__dbTx) return fn(tx);
            (tx as any).__dbTx = true;
            let r = 0;
            let w = 0;
            let d = 0;
            const origGet = tx.get?.bind(tx);
            if (origGet) {
              tx.get = async (ref: any, ...a: any[]) => {
                const snap = await origGet(ref, ...a);
                try { if (typeof snap?.exists === "function" && snap.exists()) r += 1; } catch { /* ignore */ }
                return snap;
              };
            }
            const origSet = tx.set?.bind(tx);
            if (origSet) tx.set = (rr: any, ...a: any[]) => { w += 1; return origSet(rr, ...a); };
            const origUpdate = tx.update?.bind(tx);
            if (origUpdate) tx.update = (rr: any, ...a: any[]) => { w += 1; return origUpdate(rr, ...a); };
            const origDelete = tx.delete?.bind(tx);
            if (origDelete) tx.delete = (rr: any) => { d += 1; return origDelete(rr); };

            const out = fn(tx);
            if (out && typeof out.then === "function") {
              out.then(
                () => {
                  if (r) emit("read", r, "transaction", "runTransaction");
                  if (w) emit("write", w, "transaction", "runTransaction");
                  if (d) emit("delete", d, "transaction", "runTransaction");
                },
                () => { /* tx abortada: sem op */ },
              );
            }
            return out;
          } catch { return fn(tx); }
        }, ...rest);
      });
    }
  }
}
