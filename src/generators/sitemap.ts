import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { SitemapPluginOptions, SitemapEntry } from "../types.js";

// Recursive function to collect sitemap entries
async function getSitemapEntries(
    options: Required<SitemapPluginOptions>,
    dir: string,
    currentRouteSegments: string[] = [],
    ignorePath: boolean = false
  ): Promise<SitemapEntry[]> {
    const {
      baseUrl,
      defaultChangefreq,
      defaultPriority,
      formatDate,
      debug,
    } = options;
  
    let entries: SitemapEntry[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
  
    for (const item of items) {
      if (item.isDirectory()) {
        if (item.name.startsWith('_')) continue;
  
        const isIgnoredDir = item.name.startsWith('@');
        const newIgnorePath = ignorePath || isIgnoredDir;
  
        let newRouteSegments = currentRouteSegments;
        if (!isIgnoredDir && !/^\(.*\)$/.test(item.name)) {
          newRouteSegments = [...currentRouteSegments, item.name];
        } else if (debug.printIgnored) {
          console.log(`💤 Sitemap: Ignored directory ${join(dir, item.name)}`);
        }
  
        entries = entries.concat(await getSitemapEntries(options, join(dir, item.name), newRouteSegments, newIgnorePath));
      } else if (item.isFile()) {
        if (item.name.match(/^\+Page\.[^.]+$/)) {
          if (ignorePath) {
            console.warn(`⚠️ Sitemap: Cannot generate SSG path yet for: ${join(dir, item.name)}`);
            continue;
          }
  
          let routePath = currentRouteSegments.join('/');
          if (routePath === 'index') {
            routePath = '';
          }
          const loc = `${baseUrl}/${routePath}`.replace(/\/+/g, '/');
  
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
  
//
//
//

// Generate sitemap XML content (returns string instead of writing to disk)
export async function generateSitemapContent(options: Required<SitemapPluginOptions>): Promise<string> {
const {
    pagesDir,
    customEntries,
    debug,
} = options;

const resolvedPagesDir = resolve(process.cwd(), pagesDir);
const entries = await getSitemapEntries(options, resolvedPagesDir);
entries.push(...customEntries);

if (debug.printRoutes) {
    entries.forEach((e) => console.log(`✅ Sitemap: route "${e.loc}"`));
}

const xmlEntries = entries.map((entry) => {
    let xml = '  <url>\n';
    xml += `    <loc>${entry.loc}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    if (entry.priority !== undefined) xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>';
    return xml;
});

return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join('\n')}
</urlset>`;
}

// Write sitemap to disk (for production)
export async function writeSitemapToDisk(options: Required<SitemapPluginOptions>): Promise<void> {
const { filename, outputDir } = options;
const resolvedOutputDir = resolve(process.cwd(), outputDir);
await fs.mkdir(resolvedOutputDir, { recursive: true });

const sitemapContent = await generateSitemapContent(options);
await fs.writeFile(join(resolvedOutputDir, filename), sitemapContent, 'utf8');
console.log(`✅ Sitemap generated at ${join(outputDir, filename)}!`);
}
