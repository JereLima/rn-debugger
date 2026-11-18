import { safeSerialize } from "./serializer";

interface SubOptions { maxDepth?: number }

/** API genérica: debugState('cart', () => getState(), cb => store.subscribe(cb)) */
export function debugState(
  send: (msg: object) => void,
  name: string,
  getState: () => unknown,
  subscribe?: (onNext: () => void) => () => void,
  options: SubOptions = {},
) {
  const depth = options.maxDepth ?? 6;
  let lastSentJson = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastValue: unknown;

  const push = () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        let json: string;
        try {
          json = JSON.stringify(lastValue ?? "");
        } catch { return; }
        if (json === lastSentJson) return; // não reenviar state idêntico
        lastSentJson = json;
        try {
          send({
            v: 1, type: "state.snapshot", ts: Date.now(), name,
            state: safeSerialize(lastValue, 0, undefined, depth),
          });
        } catch { /* nunca quebrar o app do usuário */ }
      }, 200); // throttle trailing 200ms
    }
  };

  const read = () => { try { lastValue = getState(); } catch { return; } push(); };

  read();
  try {
    subscribe?.(read);
  } catch { /* subscribe opcional: nunca quebrar o app */ }
}

/** Redux: */
export function debugRedux(send: (msg: object) => void, store: any, name = "redux") {
  debugState(send, name, () => store.getState(), (cb) => store.subscribe(cb));
}

/** Zustand (hook ou vanilla store — ambos têm getState/subscribe): */
export function debugZustand(send: (msg: object) => void, store: any, name = "zustand") {
  debugState(send, name, () => store.getState(), (cb) => store.subscribe(cb));
}
