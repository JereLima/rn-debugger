// Re-exporta as implementações nativas do browser para o módulo Node `url`.
// O frontend do DevTools usa `url.URL` em runtime.
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;

export function parse(s: string): URL | null {
  try { return new URL(s); } catch { return null; }
}

export function format(u: unknown): string {
  return String(u);
}

export default { URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams, parse, format };
