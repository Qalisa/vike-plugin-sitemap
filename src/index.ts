import { PluginOption, ViteDevServer } from 'vite';
import { SitemapPluginOptions } from './types.js';
import { generateSitemapContent, writeSitemapToDisk } from './generators/sitemap.js';
import { generateRobotsTxtContent, robotsFileName, writeRobotsTxtToDisk } from './generators/robots.js';

const defaultBaseUrl = 'http://localhost:3000';

//
const getDefaultOptions = () : Required<SitemapPluginOptions> => ({
  pagesDir: 'pages',
  baseUrl: defaultBaseUrl,
  filename: 'sitemap.xml',
  outputDir: '.',
  defaultChangefreq: 'weekly',
  defaultPriority: 0.5,
  customEntries: [],
  formatDate: (date: Date) => date.toISOString(),
  robots: {
    userAgent: '*',
    disallow: {
      cloudflare: true,
    },
  },
  debug: {
    printRoutes: false,
    printIgnored: false,
  },
});

// Vite Plugin
export default function VikeSitemapPlugin(options: SitemapPluginOptions): PluginOption {
  //
  const defaultOptions = getDefaultOptions();
  const mergedOptions: Required<SitemapPluginOptions> = {
    ...defaultOptions,
    ...options,
    robots: { ...defaultOptions.robots, ...options.robots },
    debug: { ...defaultOptions.debug, ...options.debug },
  };

  //
  let sitemapContent = '';
  let robotsContent = '';

  // Function to update in-memory content
  const updateContent = async () => {
    sitemapContent = await generateSitemapContent(mergedOptions);
    robotsContent = generateRobotsTxtContent(mergedOptions);
  };

  return {
    name: '@qalisa/vike-plugin-sitemap',
    async configureServer(server: ViteDevServer) {
      // Initialize content when server starts
      await updateContent();

      // Middleware to serve sitemap.xml and robots.txt
      server.middlewares.use((req, res, next) => {
        if (req.url === `/${mergedOptions.filename}`) {
          res.setHeader('Content-Type', 'application/xml');
          res.end(sitemapContent);
          return;
        }
        if (req.url === `/${robotsFileName}`) {
          res.setHeader('Content-Type', 'text/plain');
          res.end(robotsContent);
          return;
        }
        next();
      });
    },
    async handleHotUpdate({ file, server }) {
      if (file.includes('pages')) {
        await updateContent();
        server.config.logger.info(`✅ Sitemap and ${robotsFileName} updated in memory`);
      }
    },
    async closeBundle() {
      // Only write to disk in production builds
      if (this.environment.config.consumer === 'client') {
        //
        if(process.env.NODE_ENV == "production" && defaultBaseUrl == mergedOptions.baseUrl) {
          console.warn(`⚠️ vike-sitemap-plugin - "baseUrl" must be defined in production; will default to ${defaultBaseUrl}.`);
        }

        //
        await writeSitemapToDisk(mergedOptions, this.environment.config.build.outDir);
        await writeRobotsTxtToDisk(mergedOptions, this.environment.config.build.outDir);
      }
    },
  };
}