import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { SitemapPluginOptions, SitemapEntry } from "../types.js";

/**
 * Helper functions to handle paths and route segments
 */
const PathUtils = {
  /**
   * Normalizes a URL by replacing multiple consecutive slashes with a single one
   */
  normalizeUrl(baseUrl: string, path: string): string {
    return `${baseUrl}/${path}`.replace(/\/+/g, '/');
  },

  /**
   * Extracts the relative path from a full file path, useful for error messages
   */
  extractRelativePath(fullPath: string): string {
    return fullPath.split('pages/')[1] || fullPath;
  },

  /**
   * Fixes domain-driven routes by removing 'pages' segments from the path
   */
  fixDomainDrivenPath(path: string): string {
    return path.replace(/\/pages\//g, '/');
  },

  /**
   * Checks if a directory name is a special directory that should be ignored in paths
   */
  isSpecialDirectory(name: string): boolean {
    return name === 'index' || /^\(.*\)$/.test(name);
  },
  
  /**
   * Checks if a directory should be skipped entirely
   */
  shouldSkipDirectory(name: string): boolean {
    return name.startsWith('_');
  },
  
  /**
   * Checks if a directory should mark its route as ignored
   */
  shouldIgnoreRoute(name: string): boolean {
    return name.startsWith('@');
  }
};

/**
 * Helper functions to handle duplicate detection and reporting
 */
const DuplicateHandler = {
  /**
   * Reports a duplicate URL detection
   */
  reportDuplicate(loc: string, currentPath: string, existingPath: string): void {
    console.warn(`⚠️ Sitemap: Duplicate URL "${loc}" - routes definition clash found -> ${currentPath} == ${existingPath}`);
  },
  
  /**
   * Reports a duplicate custom URL detection
   */
  reportCustomDuplicate(loc: string, existingPath: string): void {
    console.warn(`⚠️ Sitemap: Duplicate custom URL "${loc}" - route already defined (custom entry == ${existingPath})`);
  }
};

/**
 * Helper functions to create sitemap entries
 */
const EntryBuilder = {
  /**
   * Creates a sitemap entry with standard fields
   */
  createEntry(
    loc: string, 
    lastmod: string | undefined, 
    defaultChangefreq?: SitemapEntry['changefreq'], 
    defaultPriority?: number
  ): SitemapEntry {
    const entry: SitemapEntry = { loc };
    if (defaultChangefreq) entry.changefreq = defaultChangefreq;
    if (defaultPriority !== undefined) entry.priority = defaultPriority;
    if (lastmod) entry.lastmod = lastmod;
    return entry;
  },
  
  /**
   * Gets the last modified date for a file
   */
  async getLastModifiedDate(filePath: string, formatDate: (date: Date) => string): Promise<string | undefined> {
    try {
      const stat = await fs.stat(filePath);
      return formatDate(stat.mtime);
    } catch (err) {
      console.warn(`Could not get last modified date for ${filePath}:`, err);
      return undefined;
    }
  }
};

/**
 * Recursive function to collect sitemap entries
 */
async function getSitemapEntries(
  options: Required<SitemapPluginOptions>,
  dir: string,
  currentRouteSegments: string[] = [],
  ignorePath: boolean = false,
  isDomainDrivenPages: boolean = false,
  existingLocations: Map<string, string> = new Map() // Map to track already added URLs and their origin
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
  
  // Check if this is a "pages" directory in a domain-driven structure
  const isDomainPagesDir = dir.split('/').pop() === 'pages';
  
  // Mark subdirectories as part of a domain-driven structure if we're in a "pages" directory
  const newIsDomainDrivenPages = isDomainDrivenPages || isDomainPagesDir;
  
  for (const item of items) {
    if (item.isDirectory()) {
      // Skip directories starting with '_'
      if (PathUtils.shouldSkipDirectory(item.name)) continue;

      // Mark directories starting with '@' as paths to ignore
      const isIgnoredDir = PathUtils.shouldIgnoreRoute(item.name);
      const newIgnorePath = ignorePath || isIgnoredDir;

      let newRouteSegments = currentRouteSegments;
      
      // Handle special cases for route segments
      if (item.name === 'index') {
        // Don't add 'index' to the path
        newRouteSegments = [...currentRouteSegments];
      } 
      // Skip 'pages' segment in domain-driven structure
      else if (item.name === 'pages' && !isDomainDrivenPages) {
        newRouteSegments = [...currentRouteSegments];
      }
      // Skip ignored directories like @something from path
      else if (isIgnoredDir) {
        if (debug.printIgnored) {
          console.log(`💤 Sitemap: Ignored segment ${item.name} in path: ${join(dir, item.name)}`);
        }
        newRouteSegments = [...currentRouteSegments];
      }
      // Skip parentheses directories from path
      else if (/^\(.*\)$/.test(item.name)) {
        // Don't add this segment to the URL
        newRouteSegments = [...currentRouteSegments];
      }
      // For all other directories, add them to the path
      else {
        newRouteSegments = [...currentRouteSegments, item.name];
      }

      entries = entries.concat(await getSitemapEntries(
        options, 
        join(dir, item.name), 
        newRouteSegments, 
        newIgnorePath,
        newIsDomainDrivenPages,
        existingLocations
      ));
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
        
        // Fix paths for domain-driven structures by removing "pages" from the path
        if (isDomainDrivenPages) {
          routePath = PathUtils.fixDomainDrivenPath(routePath);
        }
        
        const loc = PathUtils.normalizeUrl(baseUrl, routePath);
        const filePath = join(dir, item.name);
        
        // Extract relative path for error message
        const currentPath = PathUtils.extractRelativePath(dir);
        
        // Check if this URL already exists in the sitemap
        if (existingLocations.has(loc)) {
          const existingPath = existingLocations.get(loc);
          // Extract relative paths for better readability of the message
          const prevRelPath = PathUtils.extractRelativePath(existingPath || '');
          DuplicateHandler.reportDuplicate(loc, currentPath, prevRelPath);
          continue;
        }
        
        // Add the URL to the set of existing URLs with its source file path
        existingLocations.set(loc, filePath);

        const lastmod = await EntryBuilder.getLastModifiedDate(filePath, formatDate);
        const entry = EntryBuilder.createEntry(loc, lastmod, defaultChangefreq, defaultPriority);
        entries.push(entry);
      }
    }
  }
  return entries;
}

/**
 * Sorts sitemap entries according to the requested priority:
 * 1. Index routes first
 * 2. Routes with parameters (like @id)
 * 3. Other routes in ascending alphabetical order
 */
function sortSitemapEntries(entries: SitemapEntry[]): SitemapEntry[] {
  return entries.sort((a, b) => {
    const pathA = a.loc.split('/').filter(Boolean);
    const pathB = b.loc.split('/').filter(Boolean);
    
    // Compare each path segment
    const minLength = Math.min(pathA.length, pathB.length);
    
    for (let i = 0; i < minLength; i++) {
      const segmentA = pathA[i];
      const segmentB = pathB[i];
      
      // If it's the last segment of path A and it's empty (index page), A has priority
      if (i === pathA.length - 1 && segmentA === '') {
        return -1;
      }
      // If it's the last segment of path B and it's empty (index page), B has priority
      if (i === pathB.length - 1 && segmentB === '') {
        return 1;
      }
      
      // If A is a parameter (starts with @) and B is not, A has priority after indexes
      if (segmentA.startsWith('@') && !segmentB.startsWith('@')) {
        return -1;
      }
      // If B is a parameter (starts with @) and A is not, B has priority after indexes
      if (segmentB.startsWith('@') && !segmentA.startsWith('@')) {
        return 1;
      }
      
      // If both are parameters or neither is a parameter, compare alphabetically
      if (segmentA !== segmentB) {
        return segmentA.localeCompare(segmentB);
      }
    }
    
    // If all compared segments are equal, the shorter path has priority
    return pathA.length - pathB.length;
  });
}

/**
 * Generate sitemap XML content (returns string instead of writing to disk)
 */
export async function generateSitemapContent(options: Required<SitemapPluginOptions>): Promise<string> {
  const {
    pagesDir,
    customEntries,
    debug,
  } = options;

  const resolvedPagesDir = resolve(process.cwd(), pagesDir);
  const existingLocations = new Map<string, string>();
  const entries = await getSitemapEntries(options, resolvedPagesDir, [], false, false, existingLocations);
  
  // Check for duplicate custom URLs
  for (const entry of customEntries) {
    if (existingLocations.has(entry.loc)) {
      DuplicateHandler.reportCustomDuplicate(entry.loc, existingLocations.get(entry.loc) || '');
    } else {
      existingLocations.set(entry.loc, 'custom entry');
      entries.push(entry);
    }
  }

  // Sort sitemap entries according to the requested priority
  const sortedEntries = sortSitemapEntries(entries);

  if (debug.printRoutes) {
    sortedEntries.forEach((e) => console.log(`✅ Sitemap: route "${e.loc}"`));
  }

  // Generate XML entries
  const xmlEntries = sortedEntries.map((entry) => {
    let xml = '  <url>\n';
    xml += `    <loc>${entry.loc}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    if (entry.priority !== undefined) xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>';
    return xml;
  });

  // Return the complete XML document
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join('\n')}
</urlset>`;
}

/**
 * Write sitemap to disk (for production)
 */
export async function writeSitemapToDisk(options: Required<SitemapPluginOptions>, viteOutdir: string): Promise<void> {
  const { filename, outputDir } = options;
  const resolvedOutputDir = resolve(process.cwd(), viteOutdir, outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  const sitemapContent = await generateSitemapContent(options);

  const writeTo = join(resolvedOutputDir, filename);
  await fs.writeFile(writeTo, sitemapContent, 'utf8');
  console.log(`✅ Sitemap generated at "${writeTo}" !`);
}
