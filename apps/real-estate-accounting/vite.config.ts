import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { embedTokenBff } from "./server/embed-token-bff.js";

const appDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, appDir, "");
  const apiTarget =
    env.VITE_PAPREL_API_BASE_URL || env.VITE_PAPREL_BASE_URL || env.PAPREL_API_BASE_URL || "http://localhost:8080";

  return {
    root: appDir,
    server: {
      host: "127.0.0.1",
      port: 5181,
      strictPort: true,
      proxy: {
        "/v1": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: command === "serve" ? [embedTokenBff(env)] : [],
  };
});
