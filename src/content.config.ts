import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Chapters live in /content (outside src) as MDX. See docs/ARCHITECTURE.md.
const chapters = defineCollection({
  // CCDVP_ONLY=<slug> builds only that chapter (plus intro), so parallel drafting workers don't break each other's builds.
  loader: glob({
    pattern: process.env.CCDVP_ONLY ? [`**/*${process.env.CCDVP_ONLY}.mdx`, '00-introduction.mdx'] : '**/*.mdx',
    base: './content',
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // 'skill' chapters map to a syllabus skill id; 'reference' chapters live under /reference/<slug>/;
    // 'intro' is rendered on the home page.
    kind: z.enum(['skill', 'reference', 'intro']),
    skill: z.string().optional(), // "2.1" when kind === 'skill'
    slug: z.string(), // must equal the syllabus slug for skills; URL segment for reference pages
    order: z.number().default(0), // ordering for reference pages
    status: z.enum(['draft', 'fact-checked']).default('draft'),
    lastReviewed: z.string(), // ISO date of last fact-check
    citations: z.string().optional(), // citation file stem in research/citations; defaults to slug
  }),
});

export const collections = { chapters };
