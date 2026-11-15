import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const target =
    process.env.TEMPVS_DEV_ORIGIN ||
    loadEnv(mode, process.cwd(), "TEMPVS_").TEMPVS_DEV_ORIGIN ||
    "https://dev.tempvs.club";
  const proxy = {
    "^/(api|auth)(/|$)": {
      target,
      changeOrigin: true,
      secure: true,
      xfwd: true,
      rewrite(path: string) {
        if (!path.startsWith("/auth/login")) return path;
        const url = new URL(path, target);
        url.searchParams.set("local", "1");
        return `${url.pathname}${url.search}`;
      },
      configure(proxyServer: import("vite").HttpProxy.ProxyServer) {
        proxyServer.on("proxyReq", (request) => {
          if (request.getHeader("origin")) request.setHeader("origin", target);
        });
      },
    },
  };

  return {
    plugins: [react()],
    base: "/",
    build: {
      // Preserve the deployed archive/rollback contract and HTML-last publishing.
      outDir: "build",
      assetsDir: "static",
      target: ["chrome111", "edge111", "firefox114", "safari16.4"],
      sourcemap: true,
    },
    server: { host: "localhost", port: 3000, strictPort: true, proxy },
    preview: { host: "localhost", port: 3000, strictPort: true, proxy },
  };
});
