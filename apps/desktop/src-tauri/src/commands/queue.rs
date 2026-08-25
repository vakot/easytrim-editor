use tauri::AppHandle;

use crate::{
    application::queue::{available_finish_actions, execute_system_action},
    domain::QueueFinishAction,
    error::AppError,
};

#[tauri::command]
pub fn available_queue_finish_actions() -> Vec<QueueFinishAction> {
    available_finish_actions()
}

#[tauri::command]
pub fn perform_queue_finish_action(
    app: AppHandle,
    action: QueueFinishAction,
) -> Result<(), AppError> {
    match action {
        QueueFinishAction::Exit => {
            app.exit(0);
            Ok(())
        }
        QueueFinishAction::SystemSleep | QueueFinishAction::SystemShutdown => {
            execute_system_action(action)
        }
        QueueFinishAction::Nothing => Ok(()),
    }
}
