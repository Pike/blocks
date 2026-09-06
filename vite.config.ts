import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "/blocks/",
  build: {},
  resolve: {
    extensions: [".js", ".ts", ".json"],
  },
});
