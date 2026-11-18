// react-devtools-core não publica tipos para o entry standalone.
declare module "react-devtools-core/standalone" {
  const DevtoolsUI: {
    setContentDOMNode(node: HTMLElement | null): unknown;
    connectToSocket(socket: unknown): { close(): void };
  };
  export default DevtoolsUI;
}
