import { bumpVersion, parseVersionRequest } from "./versioning.mjs";

try {
  const request = parseVersionRequest(process.argv.slice(2));
  const { currentVersion, nextVersion } = await bumpVersion(request);
  console.log(`Updated EasyTrim Editor from ${currentVersion} to ${nextVersion}.`);
} catch (error) {
  console.error(`version:bump: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
