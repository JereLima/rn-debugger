export function diffPaths(prev: unknown, next: unknown, path: string[] = [], out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 6) return out;
  if (prev === next) return out;
  const tp = typeOf(prev), tn = typeOf(next);
  if (tp !== tn) { out.add(path.join(".") || "$"); return out; }
  if (tp === "array") {
    const a = prev as unknown[], b = next as unknown[];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length || i >= b.length) { out.add([...path, String(i)].join(".")); continue; }
      diffPaths(a[i], b[i], [...path, String(i)], out, depth + 1);
    }
    return out;
  }
  if (tp === "object") {
    const keys = new Set([...Object.keys(prev as object), ...Object.keys(next as object)]);
    for (const k of keys) diffPaths((prev as any)[k], (next as any)[k], [...path, k], out, depth + 1);
    return out;
  }
  out.add(path.join(".") || "$");
  return out;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v === "object" ? "object" : typeof v;
}
