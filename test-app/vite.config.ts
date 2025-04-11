import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";
import sitemap from '@qalisa/vike-plugin-sitemap';

export default defineConfig({
  plugins: [vike({}), react({}), sitemap({
    debug: {
      printRoutes: true,
      printIgnored: true
    }
  })],
  build: {
    target: "es2022",
  },
});
