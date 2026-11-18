export type Status = "connecting" | "connected" | "disconnected";

type MessageHandler = (msg: any) => void;
type StatusHandler = (status: Status) => void;

/**
 * WebSocket resiliente: percorre uma lista de hosts candidatos,
 * reconecta sozinho, enfileira mensagens enquanto desconectado.
 */
export class Connector {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private candidates: string[] = [];
  private idx = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  constructor(
    private port = 9090,
    private onMessage: MessageHandler,
    private onStatus: StatusHandler,
  ) {}

  start(candidates: string[]) {
    this.candidates = [...new Set(candidates.filter(Boolean))];
    this.idx = 0;
    this.onStatus("connecting");
    this.connectCurrent();
  }

  get isConnected() { return this.connected; }

  /** Envia objeto como JSON; enfileira (cap 200) se desconectado. */
  send(msg: object) {
    const text = JSON.stringify(msg);
    if (text.length > 256 * 1024) return; // mensagem gigante: descarta
    if (this.connected && this.ws) {
      this.rawSend(text);
    } else if (this.queue.length < 200) {
      this.queue.push(text);
    }
  }

  private rawSend(text: string) {
    try { this.ws?.send(text); } catch { /* ignore */ }
  }

  private connectCurrent() {
    const host = this.candidates[this.idx];
    if (!host) { this.scheduleFullRetry(5000); return; }

    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${host}:${this.port}`);
    } catch {
      this.advance();
      return;
    }
    this.ws = ws;

    // RN não garante onerror/onclose rápidos — timeout de guarda.
    const guard = setTimeout(() => {
      if (!settled) { settled = true; try { ws.close(); } catch { /* ignore */ } this.advance(); }
    }, 2500);

    ws.onopen = () => {
      clearTimeout(guard);
      settled = true;
      this.connected = true;
      this.onStatus("connected");
      const pending = this.queue;
      this.queue = [];
      for (const t of pending) this.rawSend(t);
    };
    ws.onmessage = (ev: any) => {
      try { this.onMessage(JSON.parse(ev.data)); } catch { /* frame inválido: ignora */ }
    };
    ws.onclose = () => {
      clearTimeout(guard);
      if (!settled) { settled = true; this.advance(); return; }
      this.connected = false;
      this.onStatus("disconnected");
      this.scheduleFullRetry(2000);
    };
    ws.onerror = () => { /* tratado via onclose/timeout */ };
  }

  private advance() {
    this.idx += 1;
    if (this.idx < this.candidates.length) { this.connectCurrent(); }
    else { this.scheduleFullRetry(5000); }
  }

  private scheduleFullRetry(ms: number) {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.idx = 0;
      this.connected = false;
      this.onStatus("connecting");
      this.connectCurrent();
    }, ms);
  }
}
