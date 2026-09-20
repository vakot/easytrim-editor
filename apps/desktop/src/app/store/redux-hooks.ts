import { type EqualityFn, useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./store";

const useTypedDispatch = useDispatch.withTypes<AppDispatch>();
const useTypedSelector = useSelector.withTypes<RootState>();

function useAppDispatch(): AppDispatch {
  return useTypedDispatch();
}

function useAppSelector<TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn?: EqualityFn<TSelected>,
): TSelected {
  return useTypedSelector(selector, equalityFn);
}

export { useAppDispatch, useAppSelector };
