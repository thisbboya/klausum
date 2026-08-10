import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  build: {
    rollupOptions: {
      output: {
        // The client was shipping one 795 kB vendor blob on every page, so a
        // student on mobile data paid for Supabase, charts and PDF machinery
        // before the landing page could paint — and any deploy busted the whole
        // thing from cache. Splitting by library lets the browser download in
        // parallel and keep the stable halves across releases.
        // Only libraries that genuinely load on every page belong here. Naming
        // the heavy per-route ones (katex, recharts, reactflow, pdfjs) as vendor
        // chunks was measurably worse — it hoisted them into the eager graph and
        // took the landing page from 860 kB to 2018 kB. Rollup already splits
        // those correctly per route; leave them alone.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils"))
            return "vendor-motion";
        },
      },
    },
  },
});
