import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "/blocks/",
  build: {},
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  },
});
