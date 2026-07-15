import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Allow serving files from the repo parent (supports git-worktree setups
      // where node_modules is linked from a sibling checkout).
      allow: [".."],
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split large, stable third-party code into cacheable vendor chunks that
        // load in parallel, instead of one monolithic app bundle.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router") || id.includes("react-dom") || /node_modules\/(react|scheduler)\//.test(id)) {
            return "react-vendor";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul") || id.includes("lucide-react")) {
            return "ui-vendor";
          }
          if (id.includes("@tanstack") || id.includes("@supabase")) {
            return "data-vendor";
          }
          if (id.includes("jspdf")) return "pdf-vendor";
          if (id.includes("emoji-picker-react")) return "emoji-vendor";
          // Keep Recharts/D3 with the importing route chunk. Splitting them into
          // a manual vendor chunk caused Rollup to place shared CJS helpers in
          // chart-vendor, creating a circular import with react-vendor in the
          // published build before React initialized.
          if (id.includes("react-markdown") || id.includes("remark") || id.includes("micromark") || id.includes("mdast") || id.includes("hast")) {
            return "markdown-vendor";
          }
          if (id.includes("framer-motion")) return "motion-vendor";
          return undefined;
        },
      },
    },
  },
}));
