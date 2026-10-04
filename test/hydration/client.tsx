import { hydrate } from "solid-js/web";
import { Fixture } from "./fixture";
const root = document.getElementById("root")!;
const existing = root.querySelector("#standalone");
const dispose = hydrate(() => <Fixture />, root);
Object.assign(window, {
  hydrationProof: {
    reused: existing === root.querySelector("#standalone"),
    dispose,
  },
});
