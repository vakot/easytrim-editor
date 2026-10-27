import { DOWNLOAD_URL, LICENSE_URL, REPOSITORY_URL } from "../consts/links.consts";

const links = [
  { href: DOWNLOAD_URL, label: "Releases" },
  { href: REPOSITORY_URL, label: "Source" },
  { href: LICENSE_URL, label: "License" },
] as const;

function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>© 2026 Vadym Kotliar · EasyTrim Editor</p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  className="rounded-md px-2 py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export { LandingFooter };
