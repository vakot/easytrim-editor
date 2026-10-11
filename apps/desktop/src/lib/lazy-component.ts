import { type ComponentType, lazy, type LazyExoticComponent } from "react";

type PreloadableLazyComponent<P extends object> = LazyExoticComponent<ComponentType<P>> & {
  preload: () => Promise<{ default: ComponentType<P> }>;
};

function lazyWithPreload<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): PreloadableLazyComponent<P> {
  let modulePromise: Promise<{ default: ComponentType<P> }> | undefined;
  const load = () => {
    if (!modulePromise) {
      modulePromise = loader().catch((error: unknown) => {
        modulePromise = undefined;
        throw error;
      });
    }

    return modulePromise;
  };

  return Object.assign(lazy<ComponentType<P>>(load), { preload: load });
}

function preloadOnIntent(preload: () => Promise<unknown>) {
  return () => {
    void preload().catch(() => undefined);
  };
}

export { lazyWithPreload, preloadOnIntent };
