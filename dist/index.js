import { promises as fs } from 'fs';
import { resolve, join } from 'path';
async function generateSitemap(options) {
    try {
        const { pagesDir, baseUrl, filename, outputDir, includeExtensions, excludeFiles, defaultChangefreq, defaultPriority, customEntries, formatDate } = options;
        // Resolve the pages directory
        const resolvedPagesDir = resolve(process.cwd(), pagesDir);
        // Create the output directory if it doesn't exist
        const resolvedOutputDir = resolve(process.cwd(), outputDir);
        await fs.mkdir(resolvedOutputDir, { recursive: true });
        // Get all files from the pages directory
        const files = await fs.readdir(resolvedPagesDir);
        // Generate sitemap entries from files
        const entries = [];
        for (const file of files) {
            // Skip files that should be excluded
            if (excludeFiles.includes(file))
                continue;
            // Check if the file has one of the allowed extensions
            const extension = file.substring(file.lastIndexOf('.') + 1);
            if (!includeExtensions.includes(extension))
                continue;
            // Generate the route
            let route = file.replace(new RegExp(`\\.(${includeExtensions.join('|')})$`), '');
            if (route === 'index')
                route = '';
            // Create the entry
            const entry = {
                loc: `${baseUrl}/${route}`.replace(/\/+$/, ''),
            };
            // Add optional fields
            if (defaultChangefreq)
                entry.changefreq = defaultChangefreq;
            if (defaultPriority !== undefined)
                entry.priority = defaultPriority;
            // Add the file's last modified date
            try {
                const stat = await fs.stat(join(resolvedPagesDir, file));
                entry.lastmod = formatDate(stat.mtime);
            }
            catch (err) {
                console.warn(`Could not get last modified date for ${file}:`, err);
            }
            entries.push(entry);
        }
        // Add custom entries
        entries.push(...customEntries);
        // Create XML content
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
        // Write the sitemap file
        await fs.writeFile(join(resolvedOutputDir, filename), sitemapContent, 'utf8');
        console.log(`✅ Sitemap generated at ${join(outputDir, filename)}!`);
    }
    catch (err) {
        console.error('❌ Error generating sitemap:', err);
        throw err;
    }
}
export default function VikeSitemapPlugin(options = {}) {
    // Define default options
    const defaultOptions = {
        pagesDir: 'src/pages',
        baseUrl: 'http://localhost',
        filename: 'sitemap.xml',
        outputDir: 'dist',
        includeExtensions: ['jsx', 'tsx', 'vue'],
        excludeFiles: [],
        defaultChangefreq: 'weekly',
        defaultPriority: 0.5,
        customEntries: [],
        formatDate: (date) => date.toISOString()
    };
    // Merge default options with user options
    const mergedOptions = { ...defaultOptions, ...options };
    return {
        name: 'vike-sitemap',
        apply: 'build',
        async closeBundle() {
            await generateSitemap(mergedOptions);
        }
    };
}
