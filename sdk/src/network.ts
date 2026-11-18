const MAX_BODY = 100_000;

let counter = 0;
const nextId = () => `n_${++counter}`;

// Dedupe XHR↔fetch por sequência (exata, sem janela de tempo):
// o patch de XHR incrementa `xhrSeq` a cada req capturada, de forma síncrona.
// O wrapper de fetch anota `seq` antes de chamar o fetch original e decide
// num macrotask posterior: se `xhrSeq` mudou, o XHR capturou → fica passivo;
// senão, captura via fetch (fetch nativo ou XHR substituído). Nunca duplica.
let xhrSeq = 0;

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

    xhrSeq += 1; // marca captura para o dedupe do wrapper de fetch

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

/**
 * Captura `fetch` que NÃO passa pelo XHR (fetch nativo do runtime ou
 * construtor de XMLHttpRequest substituído após o patch).
 * Dedupe por sequência (ver `xhrSeq`): se o patch de XHR capturou a mesma
 * chamada, o wrapper fica passivo — nunca duplica.
 */
export function patchFetch(send: (msg: object) => void, ignore: (url: string) => boolean) {
  const g = globalThis as any;
  const originalFetch = g.fetch;
  if (typeof originalFetch !== "function" || (originalFetch as any).__dbFetch) return;

  const wrapped = function (input: any, init?: any) {
    let method = "GET";
    let url = "";
    try {
      method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
      url = String(input?.url ?? input);
    } catch { /* mantém defaults */ }

    if (ignore(url)) {
      return originalFetch.apply(this, [input, init]);
    }

    {
      const id = nextId();
      const started = Date.now();
      const seqAtCall = xhrSeq;
      let reqBody: string | undefined;
      try {
        const b = init?.body;
        reqBody = typeof b === "string" ? b.slice(0, MAX_BODY) :
          b == null ? undefined : "[non-string body]";
      } catch { /* ignore */ }

      let result: Promise<any>;
      try {
        result = originalFetch.apply(this, [input, init]);
      } catch (err) {
        try {
          send({ v: 1, type: "network.res", id, ts: Date.now(), status: 0,
            url, duration: Date.now() - started, headers: {},
            body: undefined, error: "network error" });
        } catch { /* ignore */ }
        throw err;
      }

      // Lê o body de forma ansiosa (handlers anexados antes dos do app,
      // então o clone() acontece antes do app consumir a resposta);
      // a EMISSÃO espera a decisão de dedupe no macrotask abaixo.
      let resOutcome: { res: any; body?: string; failed?: unknown } | null = null;
      let reqSent = false;
      let resSent = false;
      const maybeEmit = () => {
        if (!reqSent || resSent || !resOutcome) return;
        resSent = true;
        try {
          if (resOutcome.failed !== undefined) {
            send({ v: 1, type: "network.res", id, ts: Date.now(), status: 0,
              url, duration: Date.now() - started, headers: {},
              body: undefined, error: "network error" });
          } else {
            send({ v: 1, type: "network.res", id, ts: Date.now(),
              status: resOutcome.res.status, url: resOutcome.res.url || url,
              duration: Date.now() - started, headers: readHeaders(resOutcome.res),
              body: resOutcome.body });
          }
        } catch { /* nunca quebrar o app do usuário */ }
      };
      const emitReq = () => {
        if (reqSent) return;
        reqSent = true;
        try {
          send({ v: 1, type: "network.req", id, ts: started,
            method, url, headers: {}, body: reqBody });
        } catch { /* ignore */ }
        maybeEmit();
      };

      Promise.resolve(result).then(
        (res) => {
          try {
            const clone = typeof res.clone === "function" ? res.clone() : null;
            if (clone && typeof clone.text === "function") {
              clone.text().then(
                (text: string) => {
                  resOutcome = { res, body: text.length > MAX_BODY
                    ? `${text.slice(0, MAX_BODY)}… (${text.length} chars)` : text };
                  maybeEmit();
                },
                () => { resOutcome = { res, body: `[${resTypeName(res)}]` }; maybeEmit(); },
              );
            } else {
              resOutcome = { res, body: undefined };
              maybeEmit();
            }
          } catch { resOutcome = { res, body: undefined }; maybeEmit(); }
        },
        (err) => { resOutcome = { res: null, failed: err }; maybeEmit(); },
      );

      // Decisão de dedupe adiada um macrotask: o patch de XHR (se ativo)
      // registra a req de forma síncrona dentro do originalFetch.
      // UMA ÚNICA chamada ao fetch original: `result` é observado e devolvido.
      setTimeout(() => {
        try {
          if (xhrSeq !== seqAtCall) return; // XHR capturou: passivo
          emitReq();
        } catch { /* ignore */ }
      }, 0);

      return result;
    }
  };

  (wrapped as any).__dbFetch = true;
  // Preserva flags do polyfill (ex.: fetch.polyfill).
  try {
    for (const k of Object.keys(originalFetch)) {
      if (!(k in (wrapped as any))) (wrapped as any)[k] = (originalFetch as any)[k];
    }
  } catch { /* ignore */ }
  g.fetch = wrapped;
}

function readHeaders(res: any): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    res.headers?.forEach?.((v: string, k: string) => { headers[String(k).toLowerCase()] = String(v); });
  } catch { /* ignore */ }
  return headers;
}

function resTypeName(res: any): string {
  try {
    if (typeof res.type === "string" && res.type) return res.type;
  } catch { /* ignore */ }
  return "binary";
}
