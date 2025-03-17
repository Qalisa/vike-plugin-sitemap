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
export default function VikeSitemapPlugin(options?: SitemapPluginOptions): Plugin;
export {};
