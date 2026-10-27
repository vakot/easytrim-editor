import { useCallback, useEffect, useState } from "react";

type GithubData<T> = { status: "error" } | { status: "loading" } | { data: T; status: "ready" };

/**
 * Loads live repository data once per visit, so new releases and stars show up without a redeploy.
 * `load` must be stable, such as a module-level function.
 */
function useGithubData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<GithubData<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setState({ data, status: "ready" }),
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt, load]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  return { retry, state };
}

export { type GithubData, useGithubData };
