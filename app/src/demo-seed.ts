// Mock: injeta dados realistas no store do RN Debugger via protocolo real.
// Uso: main.tsx dev-only — window.__zstore + ?seed=1
export default function seedDemo() {
  const CLIENT = "demo-device-1";
  const s = (window as any).__zstore; // injetado no main.tsx (apenas dev)
  if (!s) { console.error("store não exposto"); return; }

  const now = Date.now();
  const t = (sec: number) => now - sec * 1000;

  // -- infra: servidor + device conectado --
  s.getState().setServerReady(true);
  s.getState().setLocalIp("192.168.1.42");
  s.getState().clientConnected(CLIENT);
  s.getState().setHello(CLIENT, {
    type: "hello", ts: t(600),
    device: { platform: "ios", platformVersion: "17.5", deviceName: "iPhone 15 Pro" },
    app: { name: "MyShop", reactDevTools: true },
  });

  // -- console --
  const logs = [
    { type: "log", level: "log", ts: t(58), args: ["App mounted in", 812, "ms"] },
    { type: "log", level: "info", ts: t(47), args: ["Redux store hydrated", { slices: ["cart", "auth", "catalog"], version: 3 }] },
    { type: "log", level: "log", ts: t(39), args: ["useCheckout › render", { items: 3, total: 249.9 }] },
    { type: "log", level: "warn", ts: t(31), args: ["FlatList: 2 items without key prop"] },
    { type: "log", level: "error", ts: t(22), args: [{ __error: true, name: "TypeError", message: "Cannot read property 'price' of undefined", stack: "TypeError: Cannot read property 'price' of undefined\n    at CartSummary (components/Cart.tsx:42:19)\n    at renderWithHooks (react-dom:16305:18)\n    at mountIndeterminateComponent (react-dom:21079:13)" }] },
    { type: "log", level: "debug", ts: t(14), args: ["[perf] list render", { items: 120, ms: 8.4 }] },
    { type: "log", level: "log", ts: t(6), args: ["cart:checkout", { coupon: "BLACK30", discount: 0.3 }] },
  ];
  for (const l of logs) s.getState().addLog(CLIENT, l);

  // -- network --
  const net = [
    { id: "n_1", method: "GET", url: "https://api.myshop.dev/v1/products?page=2", status: 200, duration: 143, res: '{"total":234,"page":2,"items":[{"id":801,"title":"Mechanical Keyboard","price":349.9},{"id":802,"title":"USB-C Hub 7-in-1","price":129.0}]}' },
    { id: "n_2", method: "POST", url: "https://api.myshop.dev/v1/cart/coupon", status: 200, duration: 98, req: '{"code":"BLACK30"}', res: '{"valid":true,"discount":0.3}' },
    { id: "n_3", method: "GET", url: "https://api.myshop.dev/v1/user/profile", status: 401, duration: 61, res: '{"error":"token expired"}' },
    { id: "n_4", method: "GET", url: "https://cdn.myshop.dev/img/hero-2x.webp", status: 200, duration: 412, res: "[binary 84.2 KB]" },
    { id: "n_5", method: "POST", url: "https://api.myshop.dev/v1/telemetry", status: 0, duration: 3021, res: undefined, err: "network error" },
  ];
  for (const n of net) {
    s.getState().addNetReq(CLIENT, { type: "network.req", id: n.id, ts: t(50), method: n.method, url: n.url, headers: { "content-type": "application/json" }, body: n.req });
    s.getState().addNetRes(CLIENT, { type: "network.res", id: n.id, ts: t(50) + (n.duration ?? 100), status: n.status, url: n.url, duration: n.duration, headers: { "content-type": "application/json", "x-request-id": "req_" + n.id }, body: n.res, error: n.err });
  }

  // -- state (zustand-like, com diff) --
  s.getState().setStateSnapshot(CLIENT, { type: "state.snapshot", ts: t(55), name: "cart", state: { items: 2, total: 478.9, coupon: null, status: "idle" } });
  s.getState().setStateSnapshot(CLIENT, { type: "state.snapshot", ts: t(12), name: "cart", state: { items: 3, total: 249.9, coupon: "BLACK30", status: "idle" } });
  s.getState().setStateSnapshot(CLIENT, { type: "state.snapshot", ts: t(30), name: "auth", state: { userId: "u_881", name: "Jeremias", plan: "pro", lastLogin: t(86400) } });

  // -- storage --
  s.getState().setStorageSnapshot({
    type: "storage.snapshot", ts: t(40), storage: "async-storage",
    entries: [
      { key: "@user", kind: "string", value: '{"userId":"u_881","plan":"pro"}' },
      { key: "@cart", kind: "string", value: '{"items":[801,802,817],"coupon":"BLACK30"}' },
      { key: "@onboarding_done", kind: "string", value: "true" },
      { key: "@theme", kind: "string", value: "dark" },
    ],
  });
  const evts = [
    { type: "storage.write", ts: t(33), storage: "async-storage", key: "@cart", kind: "string", value: '{"items":[801,802]}' },
    { type: "storage.read", ts: t(20), storage: "async-storage", key: "@user" },
    { type: "storage.write", ts: t(12), storage: "async-storege", key: "@cart", kind: "string", value: '{"items":[801,802,817],"coupon":"BLACK30"}' },
  ];
  // fix typo do storage acima:
  evts[2].storage = "async-storage";
  for (const e of evts) s.getState().addStorageEvent(e);

  // -- firestore (experimental) --
  const fsOps = [
    { op: "read", n: 12, path: "users/u_881", detail: "get()", data: { id: "u_881", name: "Ada Lovelace", city: "São Paulo", createdAt: "2026-11-20T12:04:00.000Z" } },
    { op: "write", n: 1, path: "carts/u_881/items", detail: "arrayUnion(817)", data: { items: [801, 802, 817] } },
    { op: "read", n: 1, path: "products", detail: "query(limit=20)", data: { docs: [{ id: "p_801", title: "Camiseta RN", price: 79.9 }], more: 19 } },
    { op: "write", n: 3, path: "users/u_881/telemetry", detail: "batch()", data: { w: 3, d: 0 } },
    { op: "delete", n: 1, path: "carts/u_881/coupon" },
    { op: "read", n: 4, path: "coupons/BLACK30", data: { docs: [{ id: "BLACK30", pct: 30, validUntil: "2026-12-01T00:00:00.000Z" }, { id: "FRIDAY10", pct: 10 }] } },
  ];
  for (const [i, op] of fsOps.entries()) {
    s.getState().addFsOp({ type: "fs.op", ts: t(50 - i * 6), ...op });
  }

  console.log("✅ demo data seeded:", s.getState().logs.length, "logs,", s.getState().network.length, "network,", Object.keys(s.getState().states).length, "states,", Object.keys(s.getState().storages).length, "storages");
}
