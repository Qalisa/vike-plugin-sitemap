import { Plugin } from 'vite';
interface SitemapPluginOptions {
    pagesDir?: string;
    baseUrl?: string;
}
export default function ViteSitemapPlugin({ pagesDir, baseUrl }?: SitemapPluginOptions): Plugin;
export {};
