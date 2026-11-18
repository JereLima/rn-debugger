// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod ws;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let registry = ws::ServerRegistry::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(registry.clone())
        .invoke_handler(tauri::generate_handler![
            ws::ws_broadcast,
            ws::ws_send_to,
            ws::get_local_ip,
            ws::get_servers_ready
        ])
        .setup(move |app| {
            let servers: Vec<(&'static str, u16)> = vec![
                ("sdk", 9090),
                ("devtools", 8097),
            ];
            for (name, port) in servers {
                let handle = app.handle().clone();
                let reg = registry.clone();
                tauri::async_runtime::spawn(async move {
                    // Se a porta estiver ocupada, tenta de novo a cada 5s.
                    loop {
                        if let Err(e) = ws::start_server(handle.clone(), port, name, reg.clone()).await {
                            eprintln!("[devbridge] {name} server failed: {e:?} — retrying in 5s");
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DevBridge");
}
