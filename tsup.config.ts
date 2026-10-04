import { defineConfig } from "tsup";
import * as preset from "tsup-preset-solid";
import { solidPlugin } from "esbuild-plugin-solid";

const presetOptions: preset.PresetOptions = {
  entries: [
    {
      entry: "src/index.tsx",
      dev_entry: true,
      server_entry: true,
    },
    ...["code", "math", "cjk", "mermaid"].map((name) => ({
      entry: `src/plugins/${name}.ts`,
    })),
  ],
  drop_console: true,
  cjs: false,
};

export default defineConfig((config) => {
  const watching = !!config.watch;
  const parsedData = preset.parsePresetOptions(presetOptions, watching);

  return preset.generateTsupOptions(parsedData).map((tsupOptions) => ({
    ...tsupOptions,
    // Compile both package entry conditions with matching hydration markers.
    esbuildPlugins: tsupOptions.esbuildPlugins?.map((plugin) =>
      plugin.name === "esbuild:solid"
        ? solidPlugin({
            solid: {
              generate: Object.keys(tsupOptions.entry ?? {}).some(
                (name) => name === "server" || name.endsWith("/server"),
              )
                ? "ssr"
                : "dom",
              hydratable: true,
            },
          })
        : plugin,
    ),
  }));
});
