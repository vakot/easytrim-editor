use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
};

use tauri::{
    AppHandle, Manager, Runtime,
    http::{
        HeaderValue, Method, Request, Response, StatusCode,
        header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE},
    },
};

use crate::state::AppState;

const MAX_RESPONSE_BYTES: u64 = 4 * 1024 * 1024;

pub fn respond<R: Runtime>(app: &AppHandle<R>, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return empty_response(StatusCode::METHOD_NOT_ALLOWED);
    }

    let source_id = request.uri().path().trim_matches('/');
    if source_id.is_empty() || source_id.contains('/') {
        return empty_response(StatusCode::NOT_FOUND);
    }

    let state = app.state::<AppState>();
    let Ok(source) = state.resolve_source(source_id) else {
        return empty_response(StatusCode::NOT_FOUND);
    };

    read_media_response(
        &source.path,
        request.method() == Method::HEAD,
        request.headers().get("range"),
    )
}

fn read_media_response(
    path: &Path,
    is_head: bool,
    range_header: Option<&HeaderValue>,
) -> Response<Vec<u8>> {
    let Ok(mut file) = File::open(path) else {
        return empty_response(StatusCode::NOT_FOUND);
    };
    let Ok(file_length) = file.metadata().map(|metadata| metadata.len()) else {
        return empty_response(StatusCode::NOT_FOUND);
    };
    if file_length == 0 {
        return range_not_satisfiable(file_length);
    }

    let requested_range = match range_header {
        Some(value) => {
            let Ok(value) = value.to_str() else {
                return range_not_satisfiable(file_length);
            };
            match parse_range(value, file_length) {
                Some(range) => Some(range),
                None => return range_not_satisfiable(file_length),
            }
        }
        None => None,
    };

    let selected = requested_range.unwrap_or(ByteRange {
        start: 0,
        end: file_length - 1,
    });
    let capped_end = selected
        .end
        .min(selected.start.saturating_add(MAX_RESPONSE_BYTES - 1));
    let response_range = ByteRange {
        start: selected.start,
        end: capped_end,
    };
    let response_length = response_range.end - response_range.start + 1;
    let is_partial = requested_range.is_some() || response_length < file_length;

    let body = if is_head {
        Vec::new()
    } else {
        let Ok(buffer_length) = usize::try_from(response_length) else {
            return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
        };
        let mut body = vec![0; buffer_length];
        if file.seek(SeekFrom::Start(response_range.start)).is_err()
            || file.read_exact(&mut body).is_err()
        {
            return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
        }
        body
    };

    let mut response = Response::new(body);
    *response.status_mut() = if is_partial {
        StatusCode::PARTIAL_CONTENT
    } else {
        StatusCode::OK
    };
    insert_static_header(&mut response, ACCEPT_RANGES, "bytes");
    insert_static_header(&mut response, CONTENT_TYPE, content_type(path));
    insert_numeric_header(&mut response, CONTENT_LENGTH, response_length);
    if is_partial {
        insert_owned_header(
            &mut response,
            CONTENT_RANGE,
            format!(
                "bytes {}-{}/{}",
                response_range.start, response_range.end, file_length
            ),
        );
    }
    response
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ByteRange {
    start: u64,
    end: u64,
}

fn parse_range(value: &str, file_length: u64) -> Option<ByteRange> {
    let range = value.strip_prefix("bytes=")?;
    if range.contains(',') {
        return None;
    }

    let (start, end) = range.split_once('-')?;
    if start.is_empty() {
        let suffix_length = end.parse::<u64>().ok()?.min(file_length);
        if suffix_length == 0 {
            return None;
        }
        return Some(ByteRange {
            start: file_length - suffix_length,
            end: file_length - 1,
        });
    }

    let start = start.parse::<u64>().ok()?;
    if start >= file_length {
        return None;
    }
    let end = if end.is_empty() {
        file_length - 1
    } else {
        end.parse::<u64>().ok()?.min(file_length - 1)
    };
    (start <= end).then_some(ByteRange { start, end })
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("avi") => "video/x-msvideo",
        Some("flv") => "video/x-flv",
        Some("mkv") => "video/x-matroska",
        Some("mov") => "video/quicktime",
        Some("ts" | "mts" | "m2ts") => "video/mp2t",
        Some("webm") => "video/webm",
        Some("wmv") => "video/x-ms-wmv",
        _ => "video/mp4",
    }
}

fn empty_response(status: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = status;
    response
}

fn range_not_satisfiable(file_length: u64) -> Response<Vec<u8>> {
    let mut response = empty_response(StatusCode::RANGE_NOT_SATISFIABLE);
    insert_owned_header(
        &mut response,
        CONTENT_RANGE,
        format!("bytes */{file_length}"),
    );
    response
}

fn insert_static_header(
    response: &mut Response<Vec<u8>>,
    name: tauri::http::HeaderName,
    value: &'static str,
) {
    response
        .headers_mut()
        .insert(name, HeaderValue::from_static(value));
}

fn insert_numeric_header(
    response: &mut Response<Vec<u8>>,
    name: tauri::http::HeaderName,
    value: u64,
) {
    insert_owned_header(response, name, value.to_string());
}

fn insert_owned_header(
    response: &mut Response<Vec<u8>>,
    name: tauri::http::HeaderName,
    value: String,
) {
    if let Ok(value) = HeaderValue::from_str(&value) {
        response.headers_mut().insert(name, value);
    }
}

#[cfg(test)]
mod tests {
    use super::{ByteRange, MAX_RESPONSE_BYTES, parse_range};

    #[test]
    fn parses_bounded_open_and_suffix_ranges() {
        assert_eq!(
            parse_range("bytes=10-19", 100),
            Some(ByteRange { start: 10, end: 19 })
        );
        assert_eq!(
            parse_range("bytes=90-", 100),
            Some(ByteRange { start: 90, end: 99 })
        );
        assert_eq!(
            parse_range("bytes=-10", 100),
            Some(ByteRange { start: 90, end: 99 })
        );
    }

    #[test]
    fn rejects_invalid_or_unavailable_ranges() {
        assert_eq!(parse_range("items=0-1", 100), None);
        assert_eq!(parse_range("bytes=100-", 100), None);
        assert_eq!(parse_range("bytes=20-10", 100), None);
        assert_eq!(parse_range("bytes=0-1,5-6", 100), None);
    }

    #[test]
    fn response_chunks_remain_memory_bounded() {
        assert_eq!(MAX_RESPONSE_BYTES, 4 * 1024 * 1024);
    }
}
