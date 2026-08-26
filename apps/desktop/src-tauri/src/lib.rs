mod application;
mod commands;
mod domain;
mod error;
mod media;
mod process;
mod state;

use state::{AppState, cleanup_stale_media_artifacts};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    cleanup_stale_media_artifacts();
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .register_uri_scheme_protocol("easytrim-media", |context, request| {
            media::preview::respond(context.app_handle(), request)
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::capabilities::check_media_capabilities,
            commands::export::cancel_operation,
            commands::export::release_export_source,
            commands::export::reserve_export_source,
            commands::export::choose_output_path,
            commands::export::plan_optimized_export,
            commands::export::open_file_location,
            commands::export::render_fast,
            commands::export::render_optimized,
            commands::media::inspect_media,
            commands::media::prepare_audio_previews,
            commands::media::prepare_proxy_preview,
            commands::media::prepare_source_preview,
            commands::media::prepare_waveforms,
            commands::queue::available_queue_finish_actions,
            commands::queue::perform_queue_finish_action,
            commands::source::choose_source,
            commands::source::import_dropped_source,
            commands::source::import_source_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
