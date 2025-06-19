import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

// Custom plugin to handle script file hot reload
function scriptHotReload() {
  return {
    name: "script-hot-reload",
    handleHotUpdate(ctx: any) {
      // Check if the updated file is in the scripts directory
      if (
        ctx.file.includes("/scripts/") &&
        (ctx.file.endsWith(".ts") || ctx.file.endsWith(".js"))
      ) {
        console.log(`🔄 Script file changed: ${ctx.file}`);

        // Send a custom HMR update instead of the default one
        ctx.server.ws.send({
          type: "custom",
          event: "script-changed",
          data: {
            file: ctx.file,
            timestamp: Date.now(),
          },
        });

        // Return empty array to prevent default HMR behavior (which causes page reload)
        return [];
      }
    },
  };
}

export default defineConfig({
  plugins: [glsl(), scriptHotReload()],
  server: {
    port: 3000,
    fs: {
      allow: [".."],
    },
    hmr: {
      overlay: false, // Disable error overlay to prevent disruption during script errors
    },
    watch: {
      // Include scripts directory in watch but don't auto-reload
      ignored: ["!**/scripts/**"],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@motionjs/common": resolve(__dirname, "../common/src/index.ts"),
      "/scripts": resolve(__dirname, "../../scripts"),
    },
  },
  optimizeDeps: {
    exclude: ["/scripts"], // Prevent script files from being pre-bundled to enable dynamic imports
  },
});
