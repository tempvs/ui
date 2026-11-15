import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

/** Bundle real components into isolated browser fixtures without CRA loaders. */
export async function buildFixture(name: string): Promise<string> {
  const result = await build({
    entryPoints: [path.resolve("e2e/fixtures", `${name}.tsx`)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    loader: { ".svg": "dataurl", ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl" },
    plugins: [
      {
        name: "fixture-styles",
        setup(builder) {
          builder.onLoad({ filter: /\.css$/ }, async ({ path: file }) => ({
            loader: "js",
            contents: `const style = document.createElement("style");
              style.textContent = ${JSON.stringify(await readFile(file, "utf8"))};
              document.head.appendChild(style);`,
          }));
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}
