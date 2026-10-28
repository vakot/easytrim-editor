import { type ComponentType, createElement, lazy } from "react";

type PreloadableLazyComponent<P extends object> = ComponentType<P> & {
  preload: () => Promise<{ default: ComponentType<P> }>;
};

function lazyWithPreload<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): PreloadableLazyComponent<P> {
  let modulePromise: Promise<{ default: ComponentType<P> }> | undefined;
  let loadedModule: { default: ComponentType<P> } | undefined;

  const load = () => {
    if (!modulePromise) {
      modulePromise = loader()
        .then((module) => {
          loadedModule = module;
          return module;
        })
        .catch((error: unknown) => {
          modulePromise = undefined;
          throw error;
        });
    }

    return modulePromise;
  };

  const LazyModule = lazy<ComponentType<P>>(load);

  function LazyWithPreload(props: P) {
    return loadedModule
      ? createElement(loadedModule.default, props)
      : createElement(LazyModule, props);
  }

  return Object.assign(LazyWithPreload, { preload: load });
}

function preloadOnIntent(preload: () => Promise<unknown>) {
  return () => {
    void preload().catch(() => undefined);
  };
}

export { lazyWithPreload, preloadOnIntent };
