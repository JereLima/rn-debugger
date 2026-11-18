use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter, State};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

type SharedClients = Arc<Mutex<HashMap<String, mpsc::UnboundedSender<String>>>>;

#[derive(Clone, Default)]
pub struct ServerRegistry {
    inner: Arc<Mutex<HashMap<&'static str, SharedClients>>>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientEvent {
    client_id: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RelayEvent {
    client_id: String,
    text: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerErrorEvent {
    error: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerReadyEvent {
    port: u16,
}

/// Inicia servidor WS que aceita múltiplos clientes e repassa frames.
/// Cada frame recebido vira evento Tauri `{name}-message` com { clientId, text }.
/// Frames enviados aos clientes chegam via `ws_broadcast` / `ws_send_to`.
pub async fn start_server(
    app: AppHandle,
    port: u16,
    name: &'static str,
    registry: ServerRegistry,
) -> anyhow::Result<()> {
    let listener = match TcpListener::bind(("0.0.0.0", port)).await {
        Ok(l) => l,
        Err(e) => {
            let _ = app.emit(&format!("{name}-server-error"), ServerErrorEvent { error: e.to_string() });
            return Err(e.into());
        }
    };
    let _ = app.emit(&format!("{name}-server-ready"), ServerReadyEvent { port });
    println!("[devbridge] {name} server listening on 0.0.0.0:{port}");

    let clients: SharedClients = Arc::new(Mutex::new(HashMap::new()));
    registry.inner.lock().unwrap().insert(name, clients.clone());

    loop {
        let (stream, _addr) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => { eprintln!("[devbridge] accept error: {e:?}"); continue; }
        };
        let app = app.clone();
        let clients = clients.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = handle_client(app, clients, name, stream).await {
                eprintln!("[devbridge] client error: {e:?}");
            }
        });
    }
}

async fn handle_client(
    app: AppHandle,
    clients: SharedClients,
    name: &'static str,
    stream: tokio::net::TcpStream,
) -> anyhow::Result<()> {
    let ws = tokio_tungstenite::accept_async(stream).await?;
    let (mut sink, mut source) = ws.split();
    let client_id = Uuid::new_v4().to_string();

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    clients.lock().unwrap().insert(client_id.clone(), tx);

    let _ = app.emit(&format!("{name}-client-connected"), ClientEvent { client_id: client_id.clone() });
    println!("[devbridge] {name} client connected: {client_id}");

    let mut close_reason: Option<anyhow::Error> = None;
    loop {
        tokio::select! {
            maybe_out = rx.recv() => match maybe_out {
                Some(text) => { if sink.send(Message::Text(text)).await.is_err() { break; } }
                None => break,
            },
            maybe_in = source.next() => match maybe_in {
                Some(Ok(Message::Text(text))) => {
                    println!("[devbridge] {name} frame from {client_id}: {} bytes", text.len());
                    let _ = app.emit(&format!("{name}-message"), RelayEvent {
                        client_id: client_id.clone(),
                        text: text.to_string(),
                    });
                }
                Some(Ok(Message::Ping(p))) => { let _ = sink.send(Message::Pong(p)).await; }
                Some(Ok(_)) => {}
                Some(Err(e)) => { close_reason = Some(e.into()); break; }
                None => break,
            }
        }
    }

    clients.lock().unwrap().remove(&client_id);
    println!("[devbridge] {name} client disconnected: {client_id}");
    let _ = app.emit(&format!("{name}-client-disconnected"), ClientEvent { client_id });
    let _ = sink.send(Message::Close(None)).await;
    if let Some(e) = close_reason { return Err(e); }
    Ok(())
}

#[tauri::command]
pub fn ws_broadcast(registry: State<'_, ServerRegistry>, server: String, text: String) -> Result<(), String> {
    let inner = registry.inner.lock().unwrap();
    let clients = inner.get(server.as_str()).ok_or_else(|| format!("unknown server: {server}"))?;
    let guard = clients.lock().unwrap();
    for tx in guard.values() {
        let _ = tx.send(text.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn ws_send_to(registry: State<'_, ServerRegistry>, server: String, client_id: String, text: String) -> Result<(), String> {
    let inner = registry.inner.lock().unwrap();
    let clients = inner.get(server.as_str()).ok_or_else(|| format!("unknown server: {server}"))?;
    let guard = clients.lock().unwrap();
    if let Some(tx) = guard.get(&client_id) {
        let _ = tx.send(text);
    }
    Ok(())
}

#[tauri::command]
pub fn get_local_ip() -> Option<String> {
    local_ip_address::local_ip().ok().map(|ip| ip.to_string())
}
