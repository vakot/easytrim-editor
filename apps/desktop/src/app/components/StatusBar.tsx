import packageJson from "../../../../../package.json";

export function StatusBar() {
  const appSha = import.meta.env.VITE_APP_SHA?.trim();

  return (
    <footer
      data-slot="status-bar"
      className="flex h-8 min-h-8 shrink-0 items-center border-t border-border bg-card/30 px-6 py-1 text-xs text-muted-foreground"
    >
      <span className="flex items-center gap-1.5">
        <span>v{packageJson.version}</span>
        {appSha ? (
          <>
            <span aria-hidden="true">·</span>
            <code>{appSha.slice(0, 7)}</code>
          </>
        ) : null}
      </span>
    </footer>
  );
}
