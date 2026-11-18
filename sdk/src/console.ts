import { safeSerialize } from "./serializer";

const LEVELS = ["log", "info", "warn", "error", "debug"] as const;
let patching = false; // reentrância: não logar logs do próprio patch

export function patchConsole(send: (msg: object) => void) {
  for (const level of LEVELS) {
    const original = (console as any)[level] as (...args: unknown[]) => void;
    (console as any)[level] = (...args: unknown[]) => {
      original.apply(console, args); // comportamento original intacto
      if (patching) return;
      patching = true;
      try {
        send({
          v: 1, type: "log", level, ts: Date.now(),
          args: args.slice(0, 10).map((a) => safeSerialize(a)),
        });
      } catch { /* nunca quebrar o app do usuário */ } finally {
        patching = false;
      }
    };
  }
}
