import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";
import sitemap from 'vike-plugin-sitemap'

export default defineConfig({
  plugins: [vike({}), react({}), sitemap({})],
  build: {
    target: "es2022",
  },
});
