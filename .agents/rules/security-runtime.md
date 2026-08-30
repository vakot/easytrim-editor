# Runtime and security rule

Durable runtime and security architecture is documented in [docs/runtime-security.md](../../docs/runtime-security.md).
Use it as the canonical contributor reference for Tauri IPC, paths, FFmpeg/FFprobe, temporary
files, capabilities, and packaging.

Agents must enforce these rules:

- Keep filesystem paths, canonicalization, media parsing/building, process lifecycle, cancellation,
  temporary artifacts, and packaged sidecars in Rust/native owners.
- Expose narrow typed task commands and opaque runtime IDs. Validate all IPC payloads and custom
  argument tokens again in Rust; never add generic filesystem, shell, process, or arbitrary-path
  APIs.
- Invoke validated executables with argument arrays, drain output safely, correlate progress with
  source/operation IDs, and make cancellation and cleanup idempotent.
- Preserve least privilege: explicit capabilities, restrictive CSP, no remote assets or broad
  frontend filesystem/shell access, and review plugin/protocol/binary changes as security-sensitive.
- Keep editor state ephemeral, clean temporary artifacts on every lifecycle path, protect successful
  user output, and redact private paths, secrets, and sensitive diagnostics.
