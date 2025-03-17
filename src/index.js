import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function generateSitemap(pagesDir, baseUrl) {
    try {
        const files = await fs.readdir(pagesDir);
        const urls = files
            .filter(file => file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.vue'))
            .map(file => {
            let route = file.replace(/\.(jsx|tsx|vue)$/, '');
            if (route === 'index')
                route = '';
            return `${baseUrl}/${route}`;
        });
        const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;
        await fs.writeFile(resolve('dist', 'sitemap.xml'), sitemapContent, 'utf8');
        console.log('✅ Sitemap generated!');
    }
    catch (err) {
        console.error('❌ Error generating sitemap:', err);
    }
}
export default function ViteSitemapPlugin({ pagesDir = 'src/pages', baseUrl = 'https://example.com' } = {}) {
    return {
        name: 'vite-plugin-sitemap',
        apply: 'build',
        async buildEnd() {
            await generateSitemap(resolve(__dirname, pagesDir), baseUrl);
        }
    };
}
