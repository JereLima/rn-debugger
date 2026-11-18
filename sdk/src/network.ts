const MAX_BODY = 100_000;

let counter = 0;
const nextId = () => `n_${++counter}`;

export function shouldIgnore(url: string): boolean {
  return (
    /^ws/i.test(url) ||
    /^exp:\/\//i.test(url) ||
    /\/onchange|\/symbolicate|\/status|\/open-stack-frame/i.test(url) ||
    /:8081|:8082/.test(url) // metro/dev server
  );
}

export function patchNetwork(send: (msg: object) => void, ignore: (url: string) => boolean) {
  const proto = XMLHttpRequest.prototype as any;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  proto.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    this.__db = { method: String(method || "GET").toUpperCase(), url: String(url) };
    return originalOpen.call(this, method, url, ...rest);
  };

  proto.send = function (body?: unknown) {
    const meta = this.__db;
    if (!meta || ignore(meta.url)) return originalSend.call(this, body);

    const id = nextId();
    const started = Date.now();
    const reqBody =
      typeof body === "string" ? body.slice(0, MAX_BODY) :
      body == null ? undefined : "[non-string body]";

    try {
      send({
        v: 1, type: "network.req", id, ts: started,
        method: meta.method, url: meta.url, headers: {}, body: reqBody,
      });
    } catch { /* nunca quebrar o app do usuário */ }

    const dispatch = () => {
      if (this.__dbDone) return;
      this.__dbDone = true;
      const headers: Record<string, string> = {};
      try {
        const raw = this.getAllResponseHeaders?.() || "";
        for (const line of raw.split("\r\n")) {
          const i = line.indexOf(": ");
          if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 2);
        }
      } catch { /* ignore */ }
      let resBody: string | undefined;
      try {
        const rt = this.responseType;
        if (rt === "" || rt === "text" || rt === "json") {
          const text = typeof this.responseText === "string" ? this.responseText : "";
          resBody = text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}… (${text.length} chars)` : text;
        } else {
          resBody = `[${rt || "binary"}]`;
        }
      } catch { /* ignore */ }
      try {
        send({
          v: 1, type: "network.res", id, ts: Date.now(),
          status: this.status,
          url: this.responseURL || meta.url,
          duration: Date.now() - started,
          headers,
          body: resBody,
          error: this.status === 0 ? "network error" : undefined,
        });
      } catch { /* nunca quebrar o app do usuário */ }
    };

    this.addEventListener("load", () => { if (this.readyState === 4) dispatch(); });
    this.addEventListener("error", () => { if (this.readyState !== 4) dispatch(); });
    this.addEventListener("abort", dispatch);

    return originalSend.call(this, body);
  };
}
