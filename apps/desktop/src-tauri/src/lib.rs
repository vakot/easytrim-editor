mod application;
mod commands;
mod domain;
mod error;
mod media;
mod process;
mod state;

use application::import_source::import_source;
use commands::source::{
    SOURCE_DRAG_EVENT, SOURCE_IMPORT_EVENT, SourceDragEvent, SourceImportEvent,
};
use state::AppState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::capabilities::check_media_capabilities,
            commands::media::inspect_media,
            commands::source::choose_source
        ])
        .on_webview_event(|webview, event| {
            let tauri::WebviewEvent::DragDrop(event) = event else {
                return;
            };

            match event {
                tauri::DragDropEvent::Enter { .. } => {
                    if let Err(error) =
                        webview.emit(SOURCE_DRAG_EVENT, SourceDragEvent { active: true })
                    {
                        eprintln!("failed to emit source drag event: {error}");
                    }
                }
                tauri::DragDropEvent::Leave => {
                    if let Err(error) =
                        webview.emit(SOURCE_DRAG_EVENT, SourceDragEvent { active: false })
                    {
                        eprintln!("failed to emit source drag event: {error}");
                    }
                }
                tauri::DragDropEvent::Drop { paths, .. } => {
                    if let Err(error) =
                        webview.emit(SOURCE_DRAG_EVENT, SourceDragEvent { active: false })
                    {
                        eprintln!("failed to emit source drag event: {error}");
                    }

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
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
