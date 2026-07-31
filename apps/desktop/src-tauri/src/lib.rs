mod application;
mod commands;
mod domain;
mod error;
mod media;
mod process;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("clipkit-media", |context, request| {
            media::preview::respond(context.app_handle(), request)
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::capabilities::check_media_capabilities,
            commands::export::cancel_operation,
            commands::export::choose_output_path,
            commands::export::reveal_in_explorer,
            commands::export::render_fast,
            commands::export::render_optimized,
            commands::media::inspect_media,
            commands::media::prepare_proxy_preview,
            commands::media::prepare_source_preview,
            commands::media::prepare_waveforms,
            commands::source::choose_source,
            commands::source::import_dropped_source
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
