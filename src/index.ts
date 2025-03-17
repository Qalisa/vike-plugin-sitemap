import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { Plugin } from 'vite';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
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

  // Resolve directories relative to the process's current working directory
  const resolvedPagesDir = resolve(process.cwd(), pagesDir);
  const resolvedOutputDir = resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  /**
   * Recursively walk through a directory looking for files ending with "+Page" (any extension)
   * while ignoring folders starting with "_" and building the URL route.
   */
  async function getSitemapEntries(dir: string, currentRoute: string = ''): Promise<SitemapEntry[]> {
    let entries: SitemapEntry[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        // Skip directories starting with '_'
        if (item.name.startsWith('_')) continue;
        // Append the directory name to the current route and scan recursively
        const newRoute = currentRoute ? `${currentRoute}/${item.name}` : item.name;
        entries = entries.concat(await getSitemapEntries(join(dir, item.name), newRoute));
      } else if (item.isFile()) {
        // Check if the file name contains a '+Page' suffix (case-sensitive) before the extension
        // For example: "index+Page.tsx" or "about+Page.vue"
        const match = item.name.match(/^(.*)\+Page\.[^.]+$/);
        if (match) {
          const pageName = match[1];
          let routePath = pageName ? (currentRoute ? `${currentRoute}/${pageName}` : pageName) : currentRoute;
          // If the route is exactly "index", treat it as the root (i.e. empty string)
          if (routePath === 'index') {
            routePath = '';
          }
          // Build the full URL
          let loc = `${baseUrl}/${routePath}`.replace(/\/+/g, '/');
          
          // Get the file's last modified date
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

  // Gather entries from the pages directory recursively
  const entries = await getSitemapEntries(resolvedPagesDir);
  // Include any custom entries provided via options
  entries.push(...customEntries);

  // Generate the XML content for the sitemap
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

  // Write the sitemap to the designated file
  await fs.writeFile(join(resolvedOutputDir, filename), sitemapContent, 'utf8');
  console.log(`✅ Sitemap generated at ${join(outputDir, filename)}!`);
}

export default function VikeSitemapPlugin(options: SitemapPluginOptions = {}): Plugin {
  // Define default options
  const defaultOptions: Required<SitemapPluginOptions> = {
    pagesDir: 'pages',
    baseUrl: 'http://localhost',
    filename: 'sitemap.xml',
    outputDir: 'dist/client',
    defaultChangefreq: 'weekly',
    defaultPriority: 0.5,
    customEntries: [],
    formatDate: (date: Date) => date.toISOString()
  };

  // Merge user options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  return {
    name: 'vike-sitemap',
    apply: 'build',
    async closeBundle() {
      await generateSitemap(mergedOptions);
    }
  };
}
