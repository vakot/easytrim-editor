const REPOSITORY_URL = "https://github.com/vakot/easytrim-editor";
/** Every published release, for older versions and the full asset lists. */
const RELEASES_URL = `${REPOSITORY_URL}/releases`;
/** Always the newest published release, the fallback when its details cannot be loaded. */
const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
/** Installers are only ever linked from here, so a malformed API response cannot point elsewhere. */
const RELEASE_DOWNLOAD_URL_PREFIX = `${RELEASES_URL}/download/`;
/** Read live, so star counts and new releases appear without redeploying the site. */
const REPOSITORY_API_URL = "https://api.github.com/repos/vakot/easytrim-editor";
const LICENSE_URL = `${REPOSITORY_URL}/blob/master/LICENSE`;
const FFMPEG_DOWNLOAD_URL = "https://ffmpeg.org/download.html";
/** The same support page the application links to from its status bar and Help menu. */
const KOFI_URL = "https://ko-fi.com/vakot";

export {
  FFMPEG_DOWNLOAD_URL,
  KOFI_URL,
  LATEST_RELEASE_URL,
  LICENSE_URL,
  RELEASE_DOWNLOAD_URL_PREFIX,
  RELEASES_URL,
  REPOSITORY_API_URL,
  REPOSITORY_URL,
};
