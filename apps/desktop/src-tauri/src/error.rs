use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<String>,
}

impl AppError {
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_request",
            message: message.into(),
            diagnostics: None,
        }
    }

    pub fn source_replaced() -> Self {
        Self {
            code: "source_replaced",
            message: "This source was replaced by a newer import.".to_owned(),
            diagnostics: None,
        }
    }

    pub fn unsupported_media(message: impl Into<String>) -> Self {
        Self {
            code: "unsupported_media",
            message: message.into(),
            diagnostics: None,
        }
    }

    pub fn probe_failed(
        message: impl Into<String>,
        diagnostics: Option<impl Into<String>>,
    ) -> Self {
        Self {
            code: "probe_failed",
            message: message.into(),
            diagnostics: diagnostics.map(Into::into),
        }
    }

    pub fn io_failed(message: impl Into<String>) -> Self {
        Self {
            code: "io_failed",
            message: message.into(),
            diagnostics: None,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: "internal",
            message: message.into(),
            diagnostics: None,
        }
    }
}
