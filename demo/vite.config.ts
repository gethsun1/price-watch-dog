import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow importing the repo root kernels + workflow.yaml from this demo app.
      allow: [
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
      ],
    },
  },
});
