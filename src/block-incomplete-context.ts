import { createContext, useContext, type Accessor } from "solid-js";

/** Reactive per-block state; never the whole document's streaming flag. */
export const BlockIncompleteContext = createContext<Accessor<boolean>>(
  () => false,
);
export function useIsCodeFenceIncomplete(): Accessor<boolean> {
  return useContext(BlockIncompleteContext);
}
