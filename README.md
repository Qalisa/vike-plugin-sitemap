# Vike Sitemap Plugin

A Vike plugin for generating a `sitemap.xml` and `robots.txt` file automatically based on your project structure. Early alternative to the official, soon-to-exist https://github.com/brillout/vike-sitemap.

## Features
- Automatically generates a `sitemap.xml` based on your `pages/` directory.
- Supports custom sitemap entries.
- Generates a `robots.txt` file with configurable rules.
- Updates in development mode when files change.
- Fully configurable options.

## Installation

```sh
npm install -D @qalisa/vike-plugin-sitemap
```

or

```sh
yarn add --dev @qalisa/vike-plugin-sitemap
```

or

```sh
pnpm install -D @qalisa/vike-plugin-sitemap
```

## Usage

Add the plugin to your Vike configuration:

```ts
// vike.config.ts
import sitemap from '@qalisa/vike-plugin-sitemap';

export default {
  plugins: [sitemap({
    baseUrl: 'https://yourwebsite.com' // can be omited in dev
  })]
};
```

## Configuration Options

| Option              | Type      | Default           | Description |
|---------------------|----------|-------------------|-------------|
| `pagesDir`         | `string`  | `'pages'`         | Directory containing your Vike pages. |
| `baseUrl`          | `string`  | `'http://localhost:3000'` | Base URL of your website. |
| `filename`         | `string`  | `'sitemap.xml'`   | Name of the sitemap file. |
| `outputDir`        | `string`  | `'.'`            | Output directory for the sitemap and robots.txt, relative to your output bundle client files. |
| `defaultChangefreq`| `string`  | `'weekly'`        | Default change frequency for pages. |
| `defaultPriority`  | `number`  | `0.5`             | Default priority for pages. |
| `customEntries`    | `SitemapEntry[]` | `[]` | Additional custom sitemap entries. |
| `robots`           | `RobotsOptions` | `{ userAgent: '*', disallow: { cloudflare: true } }` | Robots.txt options. |

## Development Mode

In development mode, the sitemap and robots.txt are not yet updated automatically when files change (see [#1](https://github.com/Qalisa/vike-plugin-sitemap/issues/1)). Help would be much appreciated.

## License

MIT License

