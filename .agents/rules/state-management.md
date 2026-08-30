# Frontend state-management rule

The durable EasyTrim state model is documented in [docs/state-management.md](../../docs/state-management.md).
Use it as the canonical source when changing frontend state or architecture.

Agents must enforce the following:

- Identify one owner for every value before editing: Redux for shared serializable workflow state,
  feature state for capability-owned domains, local state for ephemeral UI, Context for services,
  and runtime owners for non-serializable resources.
- Keep reducers pure and store composition focused. Use typed selectors/hooks and domain actions;
  do not synchronize storage from components or import the store singleton without a concrete
  architectural reason.
- Use thunks/listeners or existing runtime services for async orchestration. Do not add another
  effects framework or put native/process authority in Redux.
- Preserve source/operation IDs, stale-result rejection, idempotent cancellation/cleanup, and
  reserved export resources when changing source-bound workflows.
- Before a migration, record current/target source of truth, readers/writers, side effects,
  lifetime/reset semantics, and the reason Redux ownership is needed. Remove obsolete parallel
  providers and forwarding once the new owner is stable.
- Keep focused reducer, selector, and async-boundary tests with the owning module.
