import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { Plugin } from 'vite';

/**
 * Represents an entry in the sitemap.
 */
interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Options for generating the robots.txt file.
 */
interface RobotsOptions {
  userAgent?: string;
  disallow: {
    /** 
     * Specific Disallow directive for Cloudflare proxy users. 
     * @see https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/#disallow-using-robotstxt 
     */
    cloudflare: boolean;
  }
}

interface SitemapPluginOptions {
  pagesDir?: string;
  baseUrl: string;
  filename?: string;
  outputDir?: string;
  defaultChangefreq?: SitemapEntry['changefreq'];
  defaultPriority?: number;
  customEntries?: SitemapEntry[];
  formatDate?: (date: Date) => string;
  robots?: RobotsOptions;
  debug?: {
    printRoutes?: boolean;
    printIgnored?: boolean;
  }
}

// Generate sitemap.xml
async function generateSitemap(options: Required<SitemapPluginOptions>): Promise<void> {
  const {
    pagesDir,
    baseUrl,
    filename,
    outputDir,
    defaultChangefreq,
    defaultPriority,
    customEntries,
    formatDate,
    debug
  } = options;

  const resolvedPagesDir = resolve(process.cwd(), pagesDir);
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  // Recursive function to collect sitemap entries
  async function getSitemapEntries(
    dir: string,
    currentRouteSegments: string[] = [],
    ignorePath: boolean = false
  ): Promise<SitemapEntry[]> {
    let entries: SitemapEntry[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        // Skip directories starting with '_'
        if (item.name.startsWith('_')) continue;

        // If directory starts with '@', ignore the path
        const isIgnoredDir = item.name.startsWith('@');
        const newIgnorePath = ignorePath || isIgnoredDir;

        // Build new route segments
        let newRouteSegments = currentRouteSegments;
        if (!isIgnoredDir && !/^\(.*\)$/.test(item.name)) {
          newRouteSegments = [...currentRouteSegments, item.name];
        } else if (debug.printIgnored) {
          console.log(`💤 Sitemap: Ignored directory ${join(dir, item.name)}`);
        }

        // Recurse into directory
        entries = entries.concat(await getSitemapEntries(join(dir, item.name), newRouteSegments, newIgnorePath));
      } else if (item.isFile()) {
        // Only files named exactly +Page.<extension> are pages
        if (item.name.match(/^\+Page\.[^.]+$/)) {
          if (ignorePath) {
            console.warn(`⚠️  Sitemap: Cannot generate SSG path yet for: ${join(dir, item.name)}`);
            continue;
          }

          // Build route path from directory segments
          let routePath = currentRouteSegments.join('/');
          if (routePath === 'index') {
            routePath = ''; // Root page
          }
          const loc = `${baseUrl}/${routePath}`.replace(/\/+/g, '/');

          // Get last modified date
          let lastmod: string | undefined;
          try {
            const stat = await fs.stat(join(dir, item.name));
            lastmod = formatDate(stat.mtime);
          } catch (err) {
            console.warn(`Could not get last modified date for ${item.name}:`, err);
          }

          // Create sitemap entry
          const entry: SitemapEntry = { loc };
          if (defaultChangefreq) entry.changefreq = defaultChangefreq;
          if (defaultPriority !== undefined) entry.priority = defaultPriority;
          if (lastmod) entry.lastmod = lastmod;
          entries.push(entry);
        }
      }
    }
    return entries;
  }

  const entries = await getSitemapEntries(resolvedPagesDir);
  entries.push(...customEntries);

  if (debug.printRoutes) {
    entries.forEach((e) => console.log(`✅ Sitemap: route "${e.loc}"`));
  }

  // Generate XML
  const xmlEntries = entries.map(entry => {
    let xml = '  <url>\n';
    xml += `    <loc>${entry.loc}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    if (entry.priority !== undefined) xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>';
    return xml;
  });

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join('\n')}
</urlset>`;

  await fs.writeFile(join(resolvedOutputDir, filename), sitemapContent, 'utf8');
  console.log(`✅ Sitemap generated at ${join(outputDir, filename)}!`);
}

// Generate robots.txt
async function generateRobotsTxt(options: Required<SitemapPluginOptions>): Promise<void> {
  const { baseUrl, filename, outputDir, robots } = options;
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  const sitemapUrl = `${baseUrl}/${filename}`.replace(/\/+/g, '/');
  const robotsContent = `User-agent: ${robots.userAgent}
${robots.disallow.cloudflare ? 'Disallow: /cdn-cgi/' : ''}
Sitemap: ${sitemapUrl}`;

  await fs.writeFile(join(resolvedOutputDir, 'robots.txt'), robotsContent.trim(), 'utf8');
  console.log(`✅ robots.txt generated at ${join(outputDir, 'robots.txt')}!`);
}

// Vite Plugin
export default function VikeSitemapPlugin(options: SitemapPluginOptions): Plugin {
  const defaultOptions: Required<SitemapPluginOptions> = {
    pagesDir: 'pages',
    baseUrl: 'http://localhost',
    filename: 'sitemap.xml',
    outputDir: process.env.NODE_ENV === 'development' ? 'public' : 'dist/client',
    defaultChangefreq: 'weekly',
    defaultPriority: 0.5,
    customEntries: [],
    formatDate: (date: Date) => date.toISOString(),
    robots: {
      userAgent: '*',
      disallow: {
        cloudflare: true,
      }
    },
    debug: {
      printRoutes: false,
      printIgnored: false
    }
  };

  const mergedOptions: Required<SitemapPluginOptions> = {
    ...defaultOptions,
    ...options,
    robots: { ...defaultOptions.robots, ...options.robots },
    debug: { ...defaultOptions.debug, ...options.debug }
  };

  return {
    name: 'vike-plugin-sitemap',
    apply: 'build',
    async closeBundle(c) {
      await generateSitemap(mergedOptions);
      await generateRobotsTxt(mergedOptions);
    },
    configureServer(server) {
      const generateAndNotify = async () => {
        await generateSitemap(mergedOptions);
        await generateRobotsTxt(mergedOptions);
        console.log('✅ Sitemap and robots.txt updated in dev mode');
      };

      server.watcher.on('add', generateAndNotify);
      server.watcher.on('unlink', generateAndNotify);
      server.watcher.on('change', generateAndNotify);

      generateAndNotify();
    }
  };
}