// Stub do módulo Node `stream` para o iframe React DevTools.
// O código do `ws` (inlinado no standalone, usado só pelo startServer que
// nunca chamamos) estende stream.Writable/Readable no eval — precisam existir
// como construtores válidos. Nunca são instanciados no caminho do iframe.
import { EventEmitter } from "events";

class FakeStream extends EventEmitter {
  readable = true;
  writable = true;
  destroyed = false;
  write(..._args: unknown[]) { return true; }
  end(..._args: unknown[]) { return this; }
  read(..._args: unknown[]) { return null; }
  pipe(dest: any) { return dest; }
  destroy() { this.destroyed = true; return this; }
  setEncoding(..._args: unknown[]) { return this; }
  pause() { return this; }
  resume() { return this; }
  push(..._args: unknown[]) { return true; }
  unshift(..._args: unknown[]) {}
  cork() {}
  uncork() {}
}

export class Readable extends FakeStream {}
export class Writable extends FakeStream {}
export class Duplex extends FakeStream {}
export class Transform extends FakeStream {}
export class PassThrough extends FakeStream {}

export default { Readable, Writable, Duplex, Transform, PassThrough };
