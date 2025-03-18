import { promises as fs } from 'fs';
import { resolve, join } from 'path';
/**
 * Generates a sitemap.xml file based on the pages directory and custom entries.
 */
async function generateSitemap(options) {
    const { pagesDir, baseUrl, filename, outputDir, defaultChangefreq, defaultPriority, customEntries, formatDate } = options;
    const resolvedPagesDir = resolve(process.cwd(), pagesDir);
    const resolvedOutputDir = resolve(process.cwd(), outputDir);
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    /**
     * Recursively collects sitemap entries from files ending with "+Page".
     */
    async function getSitemapEntries(dir, currentRouteSegments = [], ignorePath = false) {
        let entries = [];
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                // Skip directories starting with '_'
                if (item.name.startsWith('_'))
                    continue;
                // Check if the directory starts with '@'
                const isIgnoredDir = item.name.startsWith('@');
                const newIgnorePath = ignorePath || isIgnoredDir;
                // Only add directory to route segments if it doesn't start with '@' and doesn't match (.*)
                let newRouteSegments = currentRouteSegments;
                if (!isIgnoredDir && !/^\(.*\)$/.test(item.name)) {
                    newRouteSegments = [...currentRouteSegments, item.name];
                }
                else if (options.debug.printIgnored) {
                    console.log(`💤 Sitemap: Ignored ${join(dir, item.name)}`);
                }
                // Recurse into the directory
                entries = entries.concat(await getSitemapEntries(join(dir, item.name), newRouteSegments, newIgnorePath));
            }
            else if (item.isFile()) {
                const match = item.name.match(/^(.*)\+Page\.[^.]+$/);
                if (match) {
                    const pageName = match[1];
                    // Skip if path is ignored or pageName starts with '@'
                    if (ignorePath || (pageName && pageName.startsWith('@'))) {
                        console.warn(`⚠️  Sitemap: Cannot generate SSG path yet for: ${join(dir, item.name)}`);
                        continue;
                    }
                    // Construct route path from segments
                    const routeSegments = pageName ? [...currentRouteSegments, pageName] : currentRouteSegments;
                    let routePath = routeSegments.join('/');
                    if (routePath === 'index') {
                        routePath = '';
                    }
                    let loc = `${baseUrl}/${routePath}`.replace(/\/+/g, '/');
                    // Get last modified date
                    let lastmod;
                    try {
                        const stat = await fs.stat(join(dir, item.name));
                        lastmod = formatDate(stat.mtime);
                    }
                    catch (err) {
                        console.warn(`Could not get last modified date for ${item.name}:`, err);
                    }
                    // Create sitemap entry
                    const entry = { loc };
                    if (defaultChangefreq)
                        entry.changefreq = defaultChangefreq;
                    if (defaultPriority !== undefined)
                        entry.priority = defaultPriority;
                    if (lastmod)
                        entry.lastmod = lastmod;
                    entries.push(entry);
                }
            }
        }
        return entries;
    }
    const entries = await getSitemapEntries(resolvedPagesDir);
    entries.push(...customEntries);
    if (options.debug.printRoutes) {
        entries.forEach((e) => console.log(`✅ Sitemap: route "${e.loc}"`));
    }
    const xmlEntries = entries.map(entry => {
        let xml = '  <url>\n';
        xml += `    <loc>${entry.loc}</loc>\n`;
        if (entry.lastmod)
            xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
        if (entry.changefreq)
            xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
        if (entry.priority !== undefined)
            xml += `    <priority>${entry.priority}</priority>\n`;
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
/**
 * Generates a robots.txt file with a sitemap reference.
 */
async function generateRobotsTxt(options) {
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
/**
 * Vike plugin for generating sitemap.xml and robots.txt.
 */
export default function VikeSitemapPlugin(options) {
    const defaultOptions = {
        pagesDir: 'pages',
        baseUrl: 'http://localhost',
        filename: 'sitemap.xml',
        outputDir: process.env.NODE_ENV === 'development' ? 'public' : 'dist/client',
        defaultChangefreq: 'weekly',
        defaultPriority: 0.5,
        customEntries: [],
        formatDate: (date) => date.toISOString(),
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
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        robots: { ...defaultOptions.robots, ...options.robots }
    };
    return {
        name: 'vike-plugin-sitemap',
        apply: 'build',
        async closeBundle() {
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
