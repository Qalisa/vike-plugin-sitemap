import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { SitemapPluginOptions } from "../types.js";

// Generate robots.txt content (returns string instead of writing to disk)
export function generateRobotsTxtContent(options: Required<SitemapPluginOptions>): string {
  const { baseUrl, filename, robots } = options;
  const sitemapUrl = `${baseUrl}/${filename}`.replace(/\/+/g, '/');
  
  //
  const file = `User-agent: ${robots.userAgent}
${robots.disallow.cloudflare ? 'Disallow: /cdn-cgi/' : ''}
Sitemap: ${sitemapUrl}`;
  
  //
  return file.trim();
}

//
export const robotsFileName = 'robots.txt';

// Write robots.txt to disk (for production)
export async function writeRobotsTxtToDisk(options: Required<SitemapPluginOptions>): Promise<void> {
const { outputDir } = options;
const resolvedOutputDir = resolve(process.cwd(), outputDir);
await fs.mkdir(resolvedOutputDir, { recursive: true });

const robotsContent = generateRobotsTxtContent(options);
await fs.writeFile(join(resolvedOutputDir, robotsFileName), robotsContent, 'utf8');
console.log(`✅ ${robotsFileName} generated at ${join(outputDir, robotsFileName)}!`);
}
