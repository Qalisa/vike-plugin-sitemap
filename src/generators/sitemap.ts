import { Dirent, promises as fs } from 'fs';
import { resolve, join } from 'path';
import { SitemapPluginOptions, SitemapEntry, ResolvedPage, ResolvedPageApprouved, ClashingPathsResolutionType } from "../types.js";

/**
 * Helper functions to handle duplicate detection and reporting
 */
const DuplicateHandler = {
  /**
   * Group an array into subarrays based on a key.
   * Returns an array of arrays (not a Record).
   */
  groupBy<T, K extends string | number>(
    array: T[],
    keyGetter: (item: T) => K
  ): T[][] {
    const groups: Record<K, T[]> = array.reduce((result, item) => {
      const key = keyGetter(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    }, {} as Record<K, T[]>);

    return Object.values(groups);
  },
  /**
   * Resolve a duplicate URL detection
   */
  resolveDuplicate(
    options: Required<SitemapPluginOptions>, 
    clashingPaths: ResolvedPageApprouved[], 
  ): ResolvedPageApprouved[] {
    //
    const getResolutionMessage = (() => {
      switch(options.clashingPathsResolution) {
        case 'ignore':
          return `Still adding to sitemap.`;
        case 'remove':
        return `Removed from sitemap.`;
        case 'error':
          return "Cancelling.";
      }
    })

    const getMessage = () => `⚠️  Sitemap : Routes definition clash found -> [${clashingPaths.map(e => e.shortPath).join(', ')}]: ${getResolutionMessage()}`;

    //
    let message = "";
    if (options.debug.printRoutes) {
      message = getMessage();
      console.warn(message);
    }

    //
    switch(options.clashingPathsResolution) {
      case 'ignore':
        return [clashingPaths[0]];
      case 'remove':
        return [];
      case 'error':
        throw message ?? getMessage();
    }
  },
  

  /**
   * Reports a duplicate custom URL detection
   */
  reportCustomDuplicate(loc: string, existingPath: string): void {
    console.warn(`⚠️  Sitemap : Duplicate custom URL "${loc}" - route already defined (custom entry == ${existingPath})`);
  }
};

/**
 * Helper functions to create sitemap entries
 */
const EntryBuilder = {
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

/** */
async function getResolvedPages(rootDir: string): Promise<ResolvedPage[]> {
  //
  const isIndexable = (dir: Dirent) => dir.name.startsWith("+Page.");

  //
  const items = await fs.readdir(rootDir, { withFileTypes: true, recursive: true })

  //
  return items.filter(isIndexable).map(e => {
    //
    const shortPath = e.parentPath.substring(rootDir.length);
    const spSegments = shortPath.split("/").filter(Boolean);

    //
    type Resolution = ResolvedPage["resolution"];
    const resolve = (): Resolution => {
      //
      const segmentsOut = [];

      //
      for (const segment of spSegments) {
        //
        if (segment == "index") continue;
        if (segment == "pages") continue;
        if (segment.startsWith("(") && segment.endsWith(")")) continue;

        //
        if (segment.startsWith("_")) return { rejectReason: "specialFolder" };
        if (segment.startsWith("@")) return { rejectReason: "SSGUnhandled" };

        //
        segmentsOut.push(segment);
      }

      //
      const out = segmentsOut.join("/") + "/";

      //
      return segmentsOut.length ? "/" + out : out;
    }

    //
    return {
      shortPath,
      spSegments,
      resolution: resolve()
    } satisfies ResolvedPage;
  });
}

/**
 * Sorts sitemap entries according to the requested priority:
 * 1. Index routes first
 * 2. Routes with parameters (like @id)
 * 3. Other routes in ascending alphabetical order
 */
const resolvedPagesSorter: Parameters<ResolvedPage[]["sort"]>[0] = (a, b) => {
  const pathA = a.spSegments;
  const pathB = b.spSegments;

  // Compare each path segment
  const minLength = Math.min(pathA.length, pathB.length);

  for (let i = 0; i < minLength; i++) {
    const segmentA = pathA[i];
    const segmentB = pathB[i];

    // If it's the last segment of path A and it's an index page, A has priority
    if (i === pathA.length - 1 && segmentA === 'index') {
      return -1;
    }
    // If it's the last segment of path B and it's an index page, B has priority
    if (i === pathB.length - 1 && segmentB === 'index') {
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
};

/** */
async function getSitemapEntries(
  options: Required<SitemapPluginOptions>,
  dir: string,
): Promise<SitemapEntry[]> {
  //
  const resolvedWithoutRejection = (await getResolvedPages(dir))
    .sort(resolvedPagesSorter)
    .filter(({ shortPath, resolution }) => {
      //
      if (typeof resolution === "string") return true;

      //
      if (options.debug.printIgnored) {
        switch (resolution.rejectReason) {
          case "SSGUnhandled": {
            console.warn(`⚠️  Sitemap : Cannot generate SSG path yet for: ${shortPath}`);
          }
          default: { }
        }
      }

      //
      return false;
    }) as ResolvedPageApprouved[];

  //
  const withoutDuplicates = DuplicateHandler
    .groupBy(resolvedWithoutRejection, (e) => e.resolution)
    .flatMap((e) => {
      //
      if (e.length > 1) {
        return DuplicateHandler.resolveDuplicate(options, e);
      }

      //
      return e;
    });

  //
  const entries = withoutDuplicates.map(async ({ shortPath, resolution }) => {
    //
    const lastmod = await EntryBuilder.getLastModifiedDate(dir + shortPath, options.formatDate);

    //
    return {
      lastmod,
      loc: options.baseUrl + resolution,
      changefreq: options.defaultChangefreq,
      priority: options.defaultPriority,
    };
  });

  //
  return Promise.all(entries);
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
  const entries = await getSitemapEntries(options, resolvedPagesDir);

  // Check for duplicate custom URLs
  for (const entry of customEntries) {
    if (existingLocations.has(entry.loc)) {
      DuplicateHandler.reportCustomDuplicate(entry.loc, existingLocations.get(entry.loc) || '');
    } else {
      existingLocations.set(entry.loc, 'custom entry');
      entries.push(entry);
    }
  }

  if (debug.printRoutes) {
    entries.forEach((e) => console.log(`✅ Sitemap : route "${e.loc}"`));
  }

  // Generate XML entries
  const xmlEntries = entries.map((entry) => {
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
