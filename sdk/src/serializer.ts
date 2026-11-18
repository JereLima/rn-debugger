const MAX_DEPTH = 4;
const MAX_STRING = 2000;
const MAX_ARRAY = 100;
const MAX_KEYS = 100;

/** Converte qualquer valor em algo JSON-safe e com tamanho limitado. */
export function safeSerialize(value: unknown, depth = 0, seen = new WeakSet<object>(), maxDepth = MAX_DEPTH): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "number" || t === "boolean") return value;
  if (t === "string") {
    const s = value as string;
    return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}… (${s.length} chars)` : s;
  }
  if (t === "bigint") return `${value}n`;
  if (t === "function") return `[Function ${(value as Function).name || "anonymous"}]`;
  if (t === "symbol") return String(value);
  if (value instanceof Error) {
    return {
      __error: true,
      name: value.name,
      message: value.message,
      stack: (value.stack || "").split("\n").slice(0, 8).join("\n"),
    };
  }
  if (t !== "object") return String(value);
  if (depth >= maxDepth) return "[Max depth]";
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      const head = value.slice(0, MAX_ARRAY).map((v) => safeSerialize(v, depth + 1, seen, maxDepth));
      if (value.length > MAX_ARRAY) head.push(`… +${value.length - MAX_ARRAY} items`);
      return head;
    }
    if (value instanceof Map) {
      return { __map: [...value.entries()].slice(0, MAX_KEYS)
        .map(([k, v]) => [safeSerialize(k, depth + 1, seen, maxDepth), safeSerialize(v, depth + 1, seen, maxDepth)]) };
    }
    if (value instanceof Set) {
      return { __set: [...value.values()].slice(0, MAX_KEYS).map((v) => safeSerialize(v, depth + 1, seen, maxDepth)) };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as object).slice(0, MAX_KEYS)) {
      out[k] = safeSerialize(v, depth + 1, seen, maxDepth);
    }
    return out;
  } finally {
    seen.delete(value as object); // mesma ref em dois lugares ≠ circular
  }
}
