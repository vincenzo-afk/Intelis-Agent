import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Resolve the client build directory across environments. In development the
// build lives at <repo>/dist/public. When the server is bundled (esbuild) and
// run from a different working directory — e.g. Vercel's /var/task — the entry
// file's own folder no longer points at the right place, so we probe a small
// list of candidate paths and pick the first one that actually exists.
function resolveDistPath(): string {
  const candidates = [
    // The client build sits at the repo root `public/` directory. That is where
    // Vite writes its output (`vite build` outDir) and where Vercel's Express
    // preset serves static assets from its CDN.
    path.resolve(process.cwd(), "public"),
    // Bundled server running from its own folder — public sits next to it.
    path.resolve(import.meta.dirname, "public"),
    // Older layout: build output under dist/public.
    path.resolve(import.meta.dirname, "..", "..", "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

export function serveStatic(app: Express) {
  const distPath = resolveDistPath();
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"), err => {
      if (err) {
        // The client build is missing — surface it instead of a silent 404
        console.error(
          `[static] Failed to send index.html from ${distPath}: ${err.message}`
        );
      }
    });
  });
}
