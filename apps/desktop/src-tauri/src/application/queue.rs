use std::{env, path::PathBuf, process::Command};

use crate::{domain::QueueFinishAction, error::AppError};

pub fn available_finish_actions() -> Vec<QueueFinishAction> {
    let mut actions = vec![QueueFinishAction::Exit];

    #[cfg(target_os = "windows")]
    {
        if executable_on_path("rundll32.exe").is_some() {
            actions.push(QueueFinishAction::SystemSleep);
        }
        if executable_on_path("shutdown.exe").is_some() {
            actions.push(QueueFinishAction::SystemShutdown);
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if executable_on_path("systemctl").is_some() {
            actions.push(QueueFinishAction::SystemSleep);
            actions.push(QueueFinishAction::SystemShutdown);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if executable_on_path("pmset").is_some() {
            actions.push(QueueFinishAction::SystemSleep);
        }
        if executable_on_path("osascript").is_some() {
            actions.push(QueueFinishAction::SystemShutdown);
        }
    }

    actions.push(QueueFinishAction::Nothing);
    actions
}

pub fn execute_system_action(action: QueueFinishAction) -> Result<(), AppError> {
    let (program, arguments) = match action {
        QueueFinishAction::SystemSleep => system_sleep_command()?,
        QueueFinishAction::SystemShutdown => system_shutdown_command()?,
        QueueFinishAction::Exit | QueueFinishAction::Nothing => return Ok(()),
    };

    let status = Command::new(program)
        .args(arguments)
        .status()
        .map_err(|_| AppError::io_failed("The selected system action could not be started."))?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::io_failed(
            "The selected system action was rejected by the system.",
        ))
    }
}

#[cfg(target_os = "windows")]
fn system_sleep_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("rundll32.exe")
        .ok_or_else(|| AppError::invalid_request("System sleep is not available."))?;
    Ok((program, vec!["powrprof.dll,SetSuspendState", "0,1,0"]))
}

#[cfg(target_os = "windows")]
fn system_shutdown_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("shutdown.exe")
        .ok_or_else(|| AppError::invalid_request("System shutdown is not available."))?;
    Ok((program, vec!["/s", "/t", "0"]))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn system_sleep_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("systemctl")
        .ok_or_else(|| AppError::invalid_request("System sleep is not available."))?;
    Ok((program, vec!["suspend"]))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn system_shutdown_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("systemctl")
        .ok_or_else(|| AppError::invalid_request("System shutdown is not available."))?;
    Ok((program, vec!["poweroff"]))
}

#[cfg(target_os = "macos")]
fn system_sleep_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("pmset")
        .ok_or_else(|| AppError::invalid_request("System sleep is not available."))?;
    Ok((program, vec!["sleepnow"]))
}

#[cfg(target_os = "macos")]
fn system_shutdown_command() -> Result<(PathBuf, Vec<&'static str>), AppError> {
    let program = executable_on_path("osascript")
        .ok_or_else(|| AppError::invalid_request("System shutdown is not available."))?;
    Ok((
        program,
        vec!["-e", "tell app \"System Events\" to shut down"],
    ))
}

fn executable_on_path(name: &str) -> Option<PathBuf> {
    env::var_os("PATH")
        .into_iter()
        .flat_map(|path| env::split_paths(&path).collect::<Vec<_>>())
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod tests {
    use super::available_finish_actions;
    use crate::domain::QueueFinishAction;

    #[test]
    fn finish_actions_always_include_exit_and_nothing() {
        let actions = available_finish_actions();
        assert!(actions.contains(&QueueFinishAction::Exit));
        assert!(actions.contains(&QueueFinishAction::Nothing));
    }
}
