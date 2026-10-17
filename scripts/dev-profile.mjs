export const developmentIdentifier = "com.vakot.easytrimeditor.dev";

export function parseDevArguments(args) {
  const options = args[0] === "--" ? args.slice(1) : args;
  if (options.length === 0) return { fresh: false };
  if (options.length === 1 && options[0] === "--fresh") return { fresh: true };
  throw new Error("Usage: pnpm dev [-- --fresh]");
}

export function developmentEnvironment(env, fresh) {
  return {
    ...env,
    EASYTRIM_MEDIA_DEBUG: "1",
    EASYTRIM_EPHEMERAL_PROGRESS: fresh ? "1" : "0",
  };
}
