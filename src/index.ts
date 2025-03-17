import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { Plugin } from 'vite';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

interface RobotsOptions {
  userAgent?: string;
  disallow: {
    cloudflare: boolean;
  }
}

interface SitemapPluginOptions {
  pagesDir?: string;
  baseUrl?: string;
  filename?: string;
  outputDir?: string;
  defaultChangefreq?: SitemapEntry['changefreq'];
  defaultPriority?: number;
  customEntries?: SitemapEntry[];
  formatDate?: (date: Date) => string;
  robots?: RobotsOptions;
}

async function generateSitemap(options: Required<SitemapPluginOptions>): Promise<void> {
  const {
    pagesDir,
    baseUrl,
    filename,
    outputDir,
    defaultChangefreq,
    defaultPriority,
    customEntries,
    formatDate
  } = options;

  const resolvedPagesDir = resolve(process.cwd(), pagesDir);
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  // Recursively find entries for files ending with "+Page" (ignoring directories starting with '_')
  async function getSitemapEntries(dir: string, currentRoute: string = ''): Promise<SitemapEntry[]> {
    let entries: SitemapEntry[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        if (item.name.startsWith('_')) continue;
        const newRoute = currentRoute ? `${currentRoute}/${item.name}` : item.name;
        entries = entries.concat(await getSitemapEntries(join(dir, item.name), newRoute));
      } else if (item.isFile()) {
        const match = item.name.match(/^(.*)\+Page\.[^.]+$/);
        if (match) {
          const pageName = match[1];
          let routePath = pageName ? (currentRoute ? `${currentRoute}/${pageName}` : pageName) : currentRoute;
          if (routePath === 'index') {
            routePath = '';
          }
          let loc = `${baseUrl}/${routePath}`.replace(/\/+/g, '/');
          
          let lastmod: string | undefined;
          try {
            const stat = await fs.stat(join(dir, item.name));
            lastmod = formatDate(stat.mtime);
          } catch (err) {
            console.warn(`Could not get last modified date for ${item.name}:`, err);
          }

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

async function generateRobotsTxt(options: Required<SitemapPluginOptions>): Promise<void> {
  const { baseUrl, filename, outputDir, robots } = options;
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  // Construct the absolute sitemap URL
  const sitemapUrl = `${baseUrl}/${filename}`.replace(/\/+/g, '/');
  const robotsContent = `User-agent: ${robots.userAgent}
${robots.disallow.cloudflare && `# https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/#disallow-using-robotstxt
Disallow: /cdn-cgi/`}
Sitemap: ${sitemapUrl}
`;

  await fs.writeFile(join(resolvedOutputDir, 'robots.txt'), robotsContent.trim(), 'utf8');
  console.log(`✅ robots.txt generated at ${join(outputDir, 'robots.txt')}!`);
}

export default function VikeSitemapPlugin(options: SitemapPluginOptions = {}): Plugin {
  const defaultOptions: Required<SitemapPluginOptions> = {
    pagesDir: 'pages',
    baseUrl: 'http://localhost',
    filename: 'sitemap.xml',
    outputDir: 'dist/client',
    defaultChangefreq: 'weekly',
    defaultPriority: 0.5,
    customEntries: [],
    formatDate: (date: Date) => date.toISOString(),
    robots: {
      userAgent: '*',
      disallow: {
        cloudflare: true,
      }
    }
  };

  // Merge robots options separately to allow user overrides
  const mergedOptions = { 
    ...defaultOptions, 
    ...options, 
    robots: { ...defaultOptions.robots, ...options.robots }
  };

  return {
    name: 'vike-plugin-sitemap',
    apply: 'build',

    // Build mode: generate both sitemap and robots.txt at the end of the bundle
    async closeBundle() {
      await generateSitemap(mergedOptions);
      await generateRobotsTxt(mergedOptions);
    },

    // Dev mode: generate files when the server starts and on file changes
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
