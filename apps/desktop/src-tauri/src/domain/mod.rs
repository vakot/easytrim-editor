pub mod achievements;
pub mod source;
pub mod statistics;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum QueueFinishAction {
    Exit,
    SystemSleep,
    SystemShutdown,
    Nothing,
}
