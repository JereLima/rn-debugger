// react-devtools-core não publica tipos para o entry standalone.
declare module "react-devtools-core/standalone" {
  export function setContentDOMNode(node: HTMLElement | null): unknown;
  export function connectToSocket(socket: unknown): { close(): void };
  const DevtoolsUI: {
    setContentDOMNode(node: HTMLElement | null): unknown;
    connectToSocket(socket: unknown): { close(): void };
  };
  export default DevtoolsUI;
}

// Pacote `events` (polyfill browser) sem tipos próprios.
declare module "events" {
  export class EventEmitter {
    on(type: string, listener: (...args: any[]) => void): this;
    once(type: string, listener: (...args: any[]) => void): this;
    emit(type: string, ...args: any[]): boolean;
    removeListener(type: string, listener: (...args: any[]) => void): this;
    removeAllListeners(type?: string): this;
  }
  export default EventEmitter;
}
