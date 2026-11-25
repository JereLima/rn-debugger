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

import { onDeviceCommand } from "./commands";
import { safeSerialize } from "./serializer";

type Send = (msg: object) => void;

export interface FirestoreDebugOptions {
  /** Logar cada op no console do device (default true). */
  log?: boolean;
}

let seq = 0;
const nextId = () => `fs_${++seq}`;

const MAX_LABEL = 120;

/** Avisa uma única vez por mensagem — patch que falha não pode ser invisível. */
const warned = new Set<string>();
function warnOnce(msg: string) {
  if (warned.has(msg)) return;
  warned.add(msg);
  try { console.warn(msg); } catch { /* ignore */ }
}

function labelOf(ref: any): string {
  try {
    if (typeof ref === "string") return ref.slice(0, MAX_LABEL);
    const p = ref?.__dbPath ?? ref?.path;
    if (typeof p === "string" && p) return p.slice(0, MAX_LABEL);
  } catch { /* ignore */ }
  return "query";
}

/** Payload de um write: (ref, data) | (ref, "campo", valor). */
function writePayload(rest: any[]): unknown {
  try {
    if (rest.length === 1) return rest[0];
    if (rest.length === 2 && typeof rest[0] === "string") return { [rest[0]]: rest[1] };
  } catch { /* ignore */ }
  return undefined; // merge/FieldPath/arrayUnion… — sem payload simples
}

/** Firestore-specific: Timestamp → ISO, GeoPoint → lat/lng; depois safeSerialize (caps). */
function plainFirestore(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, (_k, v: any) => {
      if (v && typeof v === "object") {
        if (typeof v.toDate === "function") return v.toDate().toISOString();
        if (typeof v.latitude === "number" && typeof v.longitude === "number") {
          return { lat: v.latitude, lng: v.longitude };
        }
      }
      return v;
    });
    if (json !== undefined) return JSON.parse(json);
  } catch { /* circular/exótico → fallback */ }
  return safeSerialize(value);
}

/** Amostra dos docs de um snapshot (cap de 3) — o feed mostra o dado, não só a contagem. */
const DOCS_CAP = 3;
function docsOfSnapshot(snap: any): unknown {
  try {
    if (snap && typeof snap.size === "number" && Array.isArray(snap.docs)) {
      const docs = snap.docs.slice(0, DOCS_CAP).map((d: any) => ({ id: d.id, ...(d.data?.() ?? {}) }));
      const more = snap.size > DOCS_CAP ? { more: snap.size - DOCS_CAP } : {};
      return plainFirestore({ docs, ...more });
    }
    if (snap && typeof snap.exists === "function") {
      return plainFirestore(snap.exists() ? { id: snap.id, ...snap.data() } : { missing: true });
    }
  } catch { /* ignore */ }
  return undefined;
}

/** Mudanças de um evento de listener (added/modified/removed), cap de 5 —
 *  removed não cobra read, mas passa a aparecer no feed em vez de passar batido. */
const CHANGES_CAP = 5;
function changesOfSnapshot(snap: any): unknown {
  try {
    if (typeof snap?.docChanges !== "function") return undefined;
    const ch = snap.docChanges();
    if (!Array.isArray(ch) || ch.length === 0) return undefined;
    const changes = ch.slice(0, CHANGES_CAP).map((c: any) => ({
      type: c?.type, id: c?.doc?.id, ...(c?.doc?.data?.() ?? {}),
    }));
    const more = ch.length > CHANGES_CAP ? { more: ch.length - CHANGES_CAP } : {};
    return plainFirestore({ changes, ...more });
  } catch { /* ignore */ }
  return undefined;
}

/** Comandos desktop→device (fs.run): executa writes com as funções JÁ
 *  INSTRUMENTADAS — a op volta pro feed do desktop como se o app tivesse feito.
 *  Guard idempotente: Fast Refresh pode re-chamar debugFirestoreInternal. */
let fsRunRegistered = false;
export function registerFsRun(api: any, send: Send): void {
  if (fsRunRegistered) return;
  fsRunRegistered = true;
  onDeviceCommand(async (msg: any) => {
    try {
      if (msg?.type !== "fs.run") return;
      const reply = (ok: boolean, text: string, docId?: string) => {
        try {
          send({
            v: 1, type: "fs.result", ts: Date.now(), reqId: msg.reqId, ok, text,
            ...(docId ? { docId } : {}),
          });
        } catch { /* ignore */ }
      };
      if (!api || typeof api.getFirestore !== "function" || typeof api.doc !== "function") {
        return reply(false, "API Firestore indisponível neste build");
      }
      const op = String(msg.op ?? "");
      const segments = String(msg.path ?? "").split("/").filter(Boolean);
      if (segments.length === 0) return reply(false, "path vazio");
      if (op === "add") {
        if (segments.length !== 1) return reply(false, '"add" exige só a coleção — a id é gerada');
        const ref = await api.addDoc(api.collection(api.getFirestore(), segments[0]), msg.data ?? {});
        return reply(true, `${segments[0]}/${ref.id}`, ref.id);
      }
      // set/update/delete exigem path de documento: col/docId (…/col/docId)
      if (segments.length % 2 !== 0) {
        return reply(false, `op "${op}" exige path de documento: col/docId`);
      }
      const ref = api.doc(api.getFirestore(), ...segments);
      if (op === "set") { await api.setDoc(ref, msg.data ?? {}); return reply(true, `set ${msg.path}`); }
      if (op === "update") { await api.updateDoc(ref, msg.data ?? {}); return reply(true, `update ${msg.path}`); }
      if (op === "delete") { await api.deleteDoc(ref); return reply(true, `delete ${msg.path}`); }
      reply(false, `op desconhecida: "${op}"`);
    } catch (e) {
      try {
        send({
          v: 1, type: "fs.result", ts: Date.now(), reqId: msg?.reqId, ok: false,
          text: String((e as Error).message ?? e),
        });
      } catch { /* ignore */ }
    }
  });
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

  const emit = (op: "read" | "write" | "delete", n: number, path: string, fn: string, data?: unknown) => {
    try {
      send({
        v: 1, type: "fs.op", ts: Date.now(), op, n, path, detail: fn,
        ...(data !== undefined ? { data } : {}),
      });
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
    } catch {
      // Exports getter-only (Babel defineProperty sem setter, ex.: RNFB v27):
      // tenta redefinir; se o módulo for mesmo selado, AVISA em vez de fingir
      // que instrumentou — silêncio aqui vira "debugger não pega nada" lá na frente.
      try {
        Object.defineProperty(api, name, { value: impl, writable: true, configurable: true });
      } catch {
        warnOnce(
          `rn-debugger: could not patch "${name}" — module exports are read-only. ` +
            `Pass a mutable facade (e.g. a plain object spreading the module) to debugFirestore().`,
        );
      }
    }
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
        emit("read", count(snap), path, name, docsOfSnapshot(snap));
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
        const data = op === "write" ? plainFirestore(writePayload(rest)) : undefined;
        emit(op, 1, path, name, data);
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
          let data: unknown;
          if (firstEvent) {
            data = docsOfSnapshot(snap); // amostra dos docs iniciais
            firstEvent = false;
            netRes(id, path, Date.now() - t0, "listener");
          } else {
            // eventos seguintes: added/modified/removed por evento
            data = changesOfSnapshot(snap);
          }
          if (n > 0 || data !== undefined) emit("read", n, path, "onSnapshot", data);
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
