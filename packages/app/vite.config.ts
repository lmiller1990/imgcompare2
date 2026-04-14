import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      "/signup": "http://localhost:8070",
      "/login": "http://localhost:8070",
      "/me": "http://localhost:8070",
    },
  },
});
