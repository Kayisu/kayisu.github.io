import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projectLocales = ['en', 'tr'] as const;
const projectPlanets = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;
const projectStatuses = ['active', 'shipped', 'prototype', 'wip', 'archived'] as const;
const projectKinds = ['product', 'research', 'experiment', 'writing', 'tool', 'game'] as const;

const nonEmptyText = z.string().trim().min(1);
const httpUrl = z
  .string()
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Use an HTTP or HTTPS URL.',
  });
const uniqueTextList = z
  .array(nonEmptyText)
  .max(20)
  .refine((values) => new Set(values.map((value) => value.toLocaleLowerCase())).size === values.length, {
    message: 'Values must be unique (case-insensitive).',
  });

const projects = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/projects',
    // Frontmatter slugs intentionally repeat across locales. Keep collection IDs
    // unique by retaining the locale directory; public routes use `data.slug`.
    generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\.md$/i, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: nonEmptyText,
      /** Stable public URL segment. Locale folders and filenames do not affect it. */
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase URL-safe slug.'),
      /** Stable identifier used to pair translations of the same project. */
      translationKey: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase URL-safe translation key.'),
      locale: z.enum(projectLocales),
      planet: z.enum(projectPlanets),
      summary: nonEmptyText,
      status: z.enum(projectStatuses),
      kind: z.enum(projectKinds).optional(),
      year: z.number().int().min(1900).max(2100).optional(),
      period: nonEmptyText.optional(),
      role: nonEmptyText.optional(),
      team: uniqueTextList.optional(),
      tags: uniqueTextList.optional(),
      repo: httpUrl.optional(),
      demo: httpUrl.optional(),
      featured: z.boolean().optional(),
      highlights: uniqueTextList.optional(),
      cover: z
        .object({
          src: image(),
          alt: nonEmptyText,
        })
        .optional(),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: nonEmptyText,
            caption: nonEmptyText.optional(),
          }),
        )
        .max(12)
        .optional(),
    }),
});

export const collections = { projects };
