import { type EqualityFn, useDispatch, useSelector, useStore } from "react-redux";

import type { AppDispatch, AppStore, RootState } from "./store";

const useTypedDispatch = useDispatch.withTypes<AppDispatch>();
const useTypedSelector = useSelector.withTypes<RootState>();
const useTypedStore = useStore.withTypes<AppStore>();

function useAppDispatch(): AppDispatch {
  return useTypedDispatch();
}

function useAppStore(): AppStore {
  return useTypedStore();
}

function useAppSelector<TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn?: EqualityFn<TSelected>,
): TSelected {
  return useTypedSelector(selector, equalityFn);
}

export { useAppDispatch, useAppSelector, useAppStore };
