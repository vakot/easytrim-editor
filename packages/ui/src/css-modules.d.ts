// Consumers bundle the package with Vite, which scopes `*.module.css` class names.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
