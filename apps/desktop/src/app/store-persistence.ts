export interface PersistedDomain<RootState> {
  key: string;
  load: () => unknown;
  select: (state: RootState) => unknown;
  save: (value: unknown) => void;
}

export function definePersistedDomain<RootState, DomainState>(domain: {
  key: string;
  load: () => DomainState;
  select: (state: RootState) => DomainState;
  save: (value: DomainState) => void;
}): PersistedDomain<RootState> {
  return {
    key: domain.key,
    load: domain.load,
    select: domain.select,
    save: (value) => domain.save(value as DomainState),
  };
}

export function hydratePersistedDomains<RootState>(
  domains: readonly PersistedDomain<RootState>[],
): Partial<RootState> {
  const hydratedState: Record<string, unknown> = {};

  for (const domain of domains) {
    hydratedState[domain.key] = domain.load();
  }

  return hydratedState as Partial<RootState>;
}

interface SubscribableStore<RootState> {
  getState: () => RootState;
  subscribe: (listener: () => void) => () => void;
}

export function observePersistedDomains<RootState>(
  store: SubscribableStore<RootState>,
  domains: readonly PersistedDomain<RootState>[],
): () => void {
  const previousValues = domains.map((domain) => domain.select(store.getState()));

  return store.subscribe(() => {
    const state = store.getState();

    domains.forEach((domain, index) => {
      const nextValue = domain.select(state);
      if (Object.is(nextValue, previousValues[index])) {
        return;
      }

      domain.save(nextValue);
      previousValues[index] = nextValue;
    });
  });
}
