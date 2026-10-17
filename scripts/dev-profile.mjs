import { lstat, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const developmentIdentifier = "com.vakot.easytrimeditor.dev";

export function parseDevArguments(args) {
  const options = args[0] === "--" ? args.slice(1) : args;
  if (options.length === 0) return { fresh: false };
  if (options.length === 1 && options[0] === "--fresh") return { fresh: true };
  throw new Error("Usage: pnpm dev [-- --fresh]");
}

export function developmentProfileDirectories(platform, env, home = homedir()) {
  let roots;
  switch (platform) {
    case "win32":
      roots = [env.APPDATA, env.LOCALAPPDATA];
      break;
    case "darwin":
      roots = [join(home, "Library", "Application Support")];
      break;
    case "linux":
      roots = [env.XDG_DATA_HOME || join(home, ".local", "share")];
      break;
    default:
      throw new Error(`Fresh development profiles are unsupported on ${platform}`);
  }
  if (roots.some((root) => !root || !isAbsolute(root))) {
    throw new Error("Development profile roots must be absolute application data directories");
  }
  return [...new Set(roots.map((root) => join(resolve(root), developmentIdentifier)))];
}

export async function cleanDevelopmentProfiles(directories) {
  // Validate every target and ancestor before removing anything. In particular, a junction
  // must never redirect a development path into the production profile.
  for (const directory of directories) {
    if (
      !isAbsolute(directory) ||
      directory !== resolve(directory) ||
      basename(directory) !== developmentIdentifier
    ) {
      throw new Error(`Refusing unsafe development profile: ${directory}`);
    }
    let current = directory;
    while (true) {
      try {
        const entry = await lstat(current);
        if (entry.isSymbolicLink() || !entry.isDirectory()) {
          throw new Error(`Refusing linked or non-directory development profile path: ${current}`);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  for (const directory of directories) {
    await rm(directory, { recursive: true, force: true });
  }
}
