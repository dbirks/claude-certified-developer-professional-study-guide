// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// GitHub Pages project sites live under /<repo>/. CI sets BASE_PATH (from actions/configure-pages) and SITE_URL.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://dbirks.github.io',
  base,
  trailingSlash: 'always',
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-dark', dark: 'github-dark' }, // Gelato: code blocks are dark (--ink) in both site themes
      defaultColor: false,
      wrap: false,
    },
  },
});
