import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// `projects` — the easy-to-extend core of the content model. Each markdown file
// under src/content/projects/ is one project; its `planet` frontmatter assigns
// the category (the celestial body it shows up under). Adding a project is just
// dropping a new .md file here — no code changes needed.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    /** card + page title */
    title: z.string(),
    /** which category (planet) this project lives under */
    planet: z.enum([
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]),
    /** short blurb for the card */
    summary: z.string(),
    status: z
      .enum(['active', 'shipped', 'prototype', 'wip', 'archived'])
      .optional(),
    year: z.number().optional(),
    tags: z.array(z.string()).optional(),
    role: z.string().optional(),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    featured: z.boolean().optional(),
  }),
});

export const collections = { projects };
