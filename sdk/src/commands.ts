// Comandos desktop→device (storage.get, devtools.res, ...).
// Módulo próprio (sem imports) para evitar ciclo: internal.ts e devtools.ts
// registram handlers aqui; o Connector despacha via dispatchDeviceCommand.
type Handler = (msg: any) => void;

const handlers = new Set<Handler>();

export function onDeviceCommand(fn: Handler): () => void {
  handlers.add(fn);
  return () => { handlers.delete(fn); };
}

export function dispatchDeviceCommand(msg: any) {
  for (const h of handlers) {
    try { h(msg); } catch { /* um handler nunca quebra os outros */ }
  }
}
