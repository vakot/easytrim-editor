# EasyTrim landing page

The static product website published at <https://vakot.github.io/easytrim-editor/>. It is a
single-page Vite + React app with no router, store, or desktop runtime. Shared presentation, such
as buttons, the achievement card and unlock toast, confetti, and the design tokens, comes from
`@easytrim-editor/ui`, so the site always matches the application.

## Develop

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:landing       # http://localhost:5173/easytrim-editor/
pnpm build:landing     # static site in apps/landing/dist
pnpm preview:landing   # serves the production build under the same base path
```

`pnpm check` also typechecks, tests, and builds the site. Focused commands:

```sh
pnpm --filter @easytrim-editor/landing typecheck
pnpm --filter @easytrim-editor/landing test
```

The site may import only `@easytrim-editor/ui` subpaths, never desktop code, Tauri, Redux, or
i18n; ESLint enforces this. Copy lives in the components, and the Getting Started achievements
and loop timing shown in the achievements section are in
`src/consts/onboarding-achievements.consts.ts`.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` builds only this app and deploys `apps/landing/dist` with the
standard GitHub Pages actions. It runs on pushes to `master` that change `apps/landing`,
`packages/ui`, the lockfile, or the workflow, and can be run manually from **Actions → Pages → Run
workflow**.

One-time repository settings:

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **Settings → Environments → github-pages:** keep `master` allowed to deploy (GitHub creates this
   environment with the default branch allowed on first deployment).

The site is served from the `/easytrim-editor/` project path, set as `base` in `vite.config.ts`;
Vite prefixes every bundled asset with it. If the repository is renamed or moved to a custom
domain, update `base` and the absolute canonical and Open Graph URLs in `index.html`.

The download buttons point to `releases/latest`, so a new release needs no site redeploy.

## Update screenshots

Screenshots are WebP files in `src/assets/screenshots`, described in
`src/consts/screenshots.consts.ts` with their `srcSet`, intrinsic size, and alt text.

1. Capture the application in its dark theme at 3840×2160 (a 1920×1080 window at 200% scaling).
   Use sample media and avoid personal file paths in the explorer.
2. Encode the full view and each crop with FFmpeg. The current files came from
   `apps/desktop/public/image.jpg`:

   ```sh
   cd apps/landing/src/assets/screenshots
   SRC=path/to/screenshot.png
   webp() { ffmpeg -y -i "$SRC" -vf "$1" -frames:v 1 -c:v libwebp -quality 80 -compression_level 6 "$2"; }
   for width in 1280 1920 2560; do webp "scale=$width:-2:flags=lanczos" "editor-$width.webp"; done
   webp "crop=2652:576:1170:1494,scale=1900:-2:flags=lanczos" timeline-1900.webp
   webp "crop=2652:576:1170:1494,scale=960:-2:flags=lanczos" timeline-960.webp
   webp "crop=1032:1120:120:86" sources-1032.webp
   webp "crop=1032:1120:120:86,scale=520:-2:flags=lanczos" sources-520.webp
   ```

   Crops are `width:height:x:y` in source pixels; adjust them to the new layout.

3. If a file name or size changes, update its imports, `srcSet`, `width`, and `height` in
   `screenshots.consts.ts`, and refresh the alt text when the content changes.
4. Regenerate the 1200×630 social preview in `public/og-image.jpg`:

   ```sh
   ffmpeg -y -i "$SRC" -vf "scale=1200:-2:flags=lanczos,crop=1200:630:0:(ih-630)/2" -frames:v 1 -q:v 4 apps/landing/public/og-image.jpg
   ```

5. Check the result with `pnpm build:landing && pnpm preview:landing`.
