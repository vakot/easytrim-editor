// Consumers bundle the package with Vite, which inlines `?raw` imports as strings.
declare module "*.svg?raw" {
  const source: string;
  export default source;
}
