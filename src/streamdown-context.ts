import { createContext, type Context } from "solid-js";
import type { StreamdownProps } from "./types";

/** The upstream public context contract, with native Solid component fields. */
export interface StreamdownContextType {
  codeBlockMaxHeight: number | string;
  controls: NonNullable<StreamdownProps["controls"]>;
  isAnimating: boolean;
  lineNumbers: boolean;
  linkSafety?: StreamdownProps["linkSafety"];
  mermaid?: StreamdownProps["mermaid"];
  mode: "static" | "streaming";
  portal?: StreamdownProps["portal"];
  shikiTheme: NonNullable<StreamdownProps["shikiTheme"]>;
  tableMaxHeight: number | string;
}
export const defaultStreamdownContext: StreamdownContextType = {
  codeBlockMaxHeight: 400,
  controls: true,
  isAnimating: false,
  lineNumbers: true,
  linkSafety: { enabled: true },
  mermaid: undefined,
  mode: "streaming",
  portal: undefined,
  shikiTheme: ["github-light", "github-dark"],
  tableMaxHeight: 300,
};
// Internal providers also carry plugin/icon/prefix options. Public defaults remain
// the exact upstream shape, rather than leaking implementation fields.
export const FeatureContext = createContext<
  Partial<StreamdownContextType> & Omit<StreamdownProps, "urlTransform">
>(defaultStreamdownContext);
export const StreamdownContext =
  FeatureContext as Context<StreamdownContextType>;
