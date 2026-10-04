import { renderToString, generateHydrationScript } from "solid-js/web";
import { Fixture } from "./fixture";
export function documentHtml() {
  if (typeof window !== "undefined" || typeof document !== "undefined")
    throw new Error("SSR must run without browser globals");
  return `<!doctype html><html><head>${generateHydrationScript()}</head><body><div id="root">${renderToString(() => <Fixture />)}</div><script type="module" src="/assets/client.js"></script></body></html>`;
}
