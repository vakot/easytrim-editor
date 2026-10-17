export const developmentIdentifier = "com.vakot.easytrimeditor.dev";
export const previewIdentifier = "com.vakot.easytrimeditor.preview";

export function parseDevArguments(args) {
  const options = args[0] === "--" ? args.slice(1) : args;
  if (options.length === 0) return { fresh: false };
  if (options.length === 1 && options[0] === "--fresh") return { fresh: true };
  throw new Error("Usage: pnpm dev [-- --fresh]");
}

export function repositoryEnvironment(env, profile, fresh = false) {
  if (profile !== "development" && profile !== "preview") {
    throw new Error(`Unknown repository profile: ${profile}`);
  }
  if (fresh && profile !== "development") {
    throw new Error("Fresh sessions require the development profile");
  }
  const environment = {
    ...env,
    EASYTRIM_REPOSITORY_PROFILE: profile,
    EASYTRIM_EPHEMERAL_PROGRESS: fresh ? "1" : "0",
  };

  if (profile === "development") environment.EASYTRIM_MEDIA_DEBUG = "1";
  else delete environment.EASYTRIM_MEDIA_DEBUG;
  return environment;
}
