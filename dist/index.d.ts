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
    };
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
    };
}
export default function VikeSitemapPlugin(options: SitemapPluginOptions): Plugin;
export {};
