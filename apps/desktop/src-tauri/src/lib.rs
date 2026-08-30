mod application;
mod commands;
mod diagnostics;
mod domain;
mod error;
mod media;
mod process;
mod state;

use std::sync::Arc;

use state::{AppState, cleanup_stale_media_artifacts};
use tauri::Manager;

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

    let app = builder
        .setup(|app| {
            let diagnostics = diagnostics::DiagnosticsState::initialize(
                app.path().app_data_dir()?,
                app.package_info().version.to_string(),
            )
            .map_err(|error| std::io::Error::other(error.message))?;
            diagnostics::install_panic_hook();
            let watchdog = Arc::clone(&diagnostics);
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    watchdog.check_heartbeat();
                }
            });
            app.manage(diagnostics);
            Ok(())
        })
        .register_uri_scheme_protocol("easytrim-media", |context, request| {
            media::preview::respond(context.app_handle(), request)
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::capabilities::check_media_capabilities,
            commands::diagnostics::diagnostics_bootstrap,
            commands::diagnostics::record_diagnostic_event,
            commands::diagnostics::record_ui_heartbeat,
            commands::diagnostics::reveal_diagnostic_report,
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
            commands::source::import_dropped_sources,
            commands::source::activate_source_path,
            commands::source::delete_source_file,
            commands::source::restore_source_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|_, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            diagnostics::complete_global_session();
        }
    });
}
