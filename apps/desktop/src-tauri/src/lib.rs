mod application;
mod commands;
mod domain;
mod error;
mod state;

use application::import_source::import_source;
use commands::source::{SOURCE_IMPORT_EVENT, SourceImportEvent};
use state::AppState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![commands::source::choose_source])
        .on_webview_event(|webview, event| {
            let tauri::WebviewEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event
            else {
                return;
            };
            let Some(path) = paths.first() else {
                return;
            };

            let state = webview.state::<AppState>();
            let event = match import_source(&state, path.clone()) {
                Ok(source) => SourceImportEvent::Selected { source },
                Err(error) => SourceImportEvent::Failed { error },
            };

            if let Err(error) = webview.emit(SOURCE_IMPORT_EVENT, event) {
                eprintln!("failed to emit source import event: {error}");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
