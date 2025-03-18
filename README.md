# Vike Sitemap Plugin

A Vike plugin for generating a `sitemap.xml` and `robots.txt` file automatically based on your project structure.

## Features
- Automatically generates a `sitemap.xml` based on your `pages/` directory.
- Supports custom sitemap entries.
- Generates a `robots.txt` file with configurable rules.
- Updates in development mode when files change.
- Fully configurable options.

## Installation

```sh
npm install -D vike-plugin-sitemap
```

or

```sh
yarn add --dev vike-plugin-sitemap
```

or

```sh
pnpm install -D vike-plugin-sitemap
```

## Usage

Add the plugin to your Vike configuration:

```ts
// vike.config.ts
import VikeSitemapPlugin from 'vike-plugin-sitemap';

export default {
  plugins: [VikeSitemapPlugin({
    baseUrl: 'https://yourwebsite.com'
  })]
};
```

## Configuration Options

| Option              | Type      | Default           | Description |
|---------------------|----------|-------------------|-------------|
| `pagesDir`         | `string`  | `'pages'`         | Directory containing your Vike pages. |
| `baseUrl`          | `string`  | `'http://localhost'` | Base URL of your website. |
| `filename`         | `string`  | `'sitemap.xml'`   | Name of the sitemap file. |
| `outputDir`        | `string`  | `'public'` (dev), `'dist/client'` (prod) | Output directory for the sitemap and robots.txt. |
| `defaultChangefreq`| `string`  | `'weekly'`        | Default change frequency for pages. |
| `defaultPriority`  | `number`  | `0.5`             | Default priority for pages. |
| `customEntries`    | `SitemapEntry[]` | `[]` | Additional custom sitemap entries. |
| `robots`           | `RobotsOptions` | `{ userAgent: '*', disallow: { cloudflare: true } }` | Robots.txt options. |

## Development Mode

In development mode, the sitemap and robots.txt are updated automatically when files change.

## License

MIT License

