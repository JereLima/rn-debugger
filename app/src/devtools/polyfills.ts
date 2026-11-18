// Polyfills que precisam existir ANTES do react-devtools-core/standalone
// ser avaliado (ele usa Buffer global no top-level em runtime de conexão).
// Importado como primeiro import em standalone.ts (ordem de avaliação importa).
import { Buffer } from "buffer";

(globalThis as any).Buffer ??= Buffer;
