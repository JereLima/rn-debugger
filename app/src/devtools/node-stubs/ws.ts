// Stub do módulo Node `ws` para o bundle do iframe React DevTools.
// O transporte real é o ParentBridgeSocket (postMessage) em standalone.ts.
export default class WsStub {
  constructor(..._args: unknown[]) {}
  on() { return this; } addEventListener() { return this; }
  removeEventListener() {} send() {} close() {}
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
}
