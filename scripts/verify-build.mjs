import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const origin = 'https://kayisu.github.io';
const errors = [];

function fail(message) {
  errors.push(message);
}

function requireFile(relativePath) {
  const absolutePath = join(dist, relativePath);
  if (!existsSync(absolutePath)) fail(`Missing generated file: ${relativePath}`);
  return absolutePath;
}

function read(relativePath) {
  const absolutePath = requireFile(relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

function htmlPath(route) {
  if (route === '/') return 'index.html';
  if (route === '/404.html') return '404.html';
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  return `${clean}/index.html`;
}

function routeForHtml(file) {
  const path = relative(dist, file).replaceAll('\\', '/');
  if (path === 'index.html') return '/';
  if (path === '404.html') return '/404.html';
  return `/${path.replace(/index\.html$/, '')}`;
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function decodeAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function islandTags(html) {
  return [...html.matchAll(/<astro-island\b[^>]*>/g)].map((match) => match[0]);
}

function islandName(tag) {
  const options = tag.match(/\bopts="([^"]+)"/)?.[1];
  if (options) {
    try {
      const parsed = JSON.parse(decodeAttribute(options));
      if (typeof parsed.name === 'string') return parsed.name;
    } catch {
      // The generic island count remains authoritative if Astro changes this payload.
    }
  }

  const componentUrl = tag.match(/\bcomponent-url="([^"]+)"/)?.[1];
  return componentUrl?.split('/').pop()?.split('.')[0] ?? 'unknown';
}

function assertIsland(route, expectedName) {
  const tags = islandTags(read(htmlPath(route)));
  const names = tags.map(islandName);
  if (tags.length !== 1 || names[0] !== expectedName) {
    fail(`${route} expected one ${expectedName} island; found ${JSON.stringify(names)}`);
  }
}

function assertStatic(route) {
  const tags = islandTags(read(htmlPath(route)));
  if (tags.length > 0) {
    fail(`${route} must be static; found ${tags.length} island(s): ${tags.map(islandName).join(', ')}`);
  }
}

function assertMetadata(route, locale, canonical, alternates) {
  const html = read(htmlPath(route));
  if (!new RegExp(`<html[^>]+lang="${locale}"`).test(html)) {
    fail(`${route} does not declare lang=${locale}`);
  }
  if (!html.includes(`<link rel="canonical" href="${origin}${canonical}">`)) {
    fail(`${route} has an incorrect or missing canonical URL`);
  }
  for (const [lang, href] of Object.entries(alternates ?? {})) {
    const tag = `<link rel="alternate" hreflang="${lang}" href="${origin}${href}">`;
    if (!html.includes(tag)) fail(`${route} is missing alternate ${lang} -> ${href}`);
  }
}

function attributeValues(html, attribute) {
  const pattern = new RegExp(`\\b${attribute}="([^"]+)"`, 'g');
  return [...html.matchAll(pattern)].map((match) => decodeAttribute(match[1]));
}

function assetReferences(html) {
  return new Set(
    ['href', 'src', 'component-url', 'renderer-url', 'before-hydration-url']
      .flatMap((attribute) => attributeValues(html, attribute))
      .filter((value) => value.startsWith('/_astro/')),
  );
}

function stylesheetHrefs(html) {
  return new Set(
    [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(
      (match) => decodeAttribute(match[1]),
    ),
  );
}

function javascriptImports(asset) {
  const file = join(dist, asset.replace(/^\//, ''));
  if (!existsSync(file) || !asset.endsWith('.js')) return [];
  const source = readFileSync(file, 'utf8');
  const imports = new Set();
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*["']([^"']+\.js)["']/g)) {
    const path = new URL(match[1], `${origin}${asset}`).pathname;
    if (path.startsWith('/_astro/')) imports.add(path);
  }
  return [...imports];
}

function javascriptGraph(initialAssets) {
  const graph = new Set();
  const queue = [...initialAssets].filter((asset) => asset.endsWith('.js'));
  while (queue.length > 0) {
    const asset = queue.shift();
    if (graph.has(asset)) continue;
    graph.add(asset);
    for (const imported of javascriptImports(asset)) {
      if (!graph.has(imported)) queue.push(imported);
    }
  }
  return graph;
}

function targetFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\//, '');
  if (!clean) return join(dist, 'index.html');
  const direct = join(dist, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  return join(direct, 'index.html');
}

function targetExists(fromHtmlFile, href) {
  if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) return true;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return false;

  const base = new URL(routeForHtml(fromHtmlFile), origin);
  const url = new URL(href, base);
  const file = targetFile(url.pathname);
  if (!existsSync(file)) return false;
  if (!url.hash) return true;

  const id = decodeURIComponent(url.hash.slice(1));
  const html = readFileSync(file, 'utf8');
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bid="${escaped}"`).test(html);
}

if (!existsSync(dist)) {
  console.error('dist/ does not exist. Run npm run build before verification.');
  process.exit(1);
}

const htmlFiles = listFiles(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [routeForHtml(file), readFileSync(file, 'utf8')]));
const interactiveRoutes = ['/', '/tr/', '/explore/', '/tr/explore/'];
const sandboxRoute = '/planet/earth/games/sandbox/';
const yksRoute = '/yks/2026/tip-tercih/';

for (const route of interactiveRoutes) assertIsland(route, 'SolarApp');
assertIsland(sandboxRoute, 'SandboxApp');
assertIsland(yksRoute, 'YksApp');

for (const [route] of htmlByRoute) {
  if (![...interactiveRoutes, sandboxRoute, yksRoute].includes(route)) assertStatic(route);
}

const planetNames = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];
const projectSlugs = ['cognitive-comfort', 'ecoreport', 'example-tool'];

for (const planet of planetNames) {
  requireFile(htmlPath(`/planet/${planet}/`));
  requireFile(htmlPath(`/tr/planet/${planet}/`));
}
for (const slug of projectSlugs) {
  requireFile(htmlPath(`/projects/${slug}/`));
  requireFile(htmlPath(`/tr/projects/${slug}/`));
}
for (const route of ['/planet/earth/games/', sandboxRoute, '/star/sun/']) {
  requireFile(htmlPath(route));
}
requireFile('404.html');

assertMetadata('/', 'en', '/', { en: '/', tr: '/tr/', 'x-default': '/' });
assertMetadata('/tr/', 'tr', '/tr/', { en: '/', tr: '/tr/', 'x-default': '/' });
assertMetadata('/explore/', 'en', '/explore/', {
  en: '/explore/',
  tr: '/tr/explore/',
  'x-default': '/explore/',
});
assertMetadata('/tr/explore/', 'tr', '/tr/explore/', {
  en: '/explore/',
  tr: '/tr/explore/',
  'x-default': '/explore/',
});
for (const planet of planetNames) {
  assertMetadata(`/planet/${planet}/`, 'en', `/planet/${planet}/`, {
    en: `/planet/${planet}/`,
    tr: `/tr/planet/${planet}/`,
    'x-default': `/planet/${planet}/`,
  });
  assertMetadata(`/tr/planet/${planet}/`, 'tr', `/tr/planet/${planet}/`, {
    en: `/planet/${planet}/`,
    tr: `/tr/planet/${planet}/`,
    'x-default': `/planet/${planet}/`,
  });
}
for (const slug of projectSlugs) {
  assertMetadata(`/projects/${slug}/`, 'en', `/projects/${slug}/`, {
    en: `/projects/${slug}/`,
    tr: `/tr/projects/${slug}/`,
    'x-default': `/projects/${slug}/`,
  });
  assertMetadata(`/tr/projects/${slug}/`, 'tr', `/tr/projects/${slug}/`, {
    en: `/projects/${slug}/`,
    tr: `/tr/projects/${slug}/`,
    'x-default': `/projects/${slug}/`,
  });
}

const localePayloads = {
  en: {
    routes: ['/', '/explore/'],
    required: 'Search portfolio categories',
    forbidden: 'Portföy kategorilerinde ara',
  },
  tr: {
    routes: ['/tr/', '/tr/explore/'],
    required: 'Portfolyo kategorilerinde ara',
    forbidden: 'Search portfolio categories',
  },
};
for (const [locale, test] of Object.entries(localePayloads)) {
  for (const route of test.routes) {
    const html = read(htmlPath(route));
    if (!html.includes(test.required) || html.includes(test.forbidden)) {
      fail(`${route} does not serialise only the ${locale} solar copy`);
    }
  }
}

const englishHome = read('index.html');
const turkishHome = read('tr/index.html');
const englishHero = 'I build practical systems across sustainability';
const turkishHero = 'Sürdürülebilirlik, uygulamalı yapay zekâ';
if (!englishHome.includes(englishHero) || englishHome.includes(turkishHero)) {
  fail('English landing copy is missing or contains the Turkish hero copy');
}
if (!turkishHome.includes(turkishHero) || turkishHome.includes(englishHero)) {
  fail('Turkish landing copy is missing or contains the English hero copy');
}

for (const absent of [
  'planet/unknown/index.html',
  'projects/unknown/index.html',
  'tr/projects/unknown/index.html',
  'planet/earth/games/unknown/index.html',
  'tr/planet/earth/games/index.html',
  'tr/star/sun/index.html',
]) {
  if (existsSync(join(dist, absent))) fail(`Unexpected route was generated: ${absent}`);
}

const sandboxHtml = read(htmlPath(sandboxRoute));
const sandboxStyles = [...stylesheetHrefs(sandboxHtml)].filter((href) => /sandbox/i.test(href));
if (sandboxStyles.length === 0) fail('Sandbox has no identifiable route stylesheet');
const nonSandboxHtml = [...htmlByRoute.entries()].filter(([route]) => route !== sandboxRoute);
for (const style of sandboxStyles) {
  if (!read(style.replace(/^\//, '')).includes('.sandbox-shell')) {
    fail(`Sandbox stylesheet does not contain the sandbox namespace: ${style}`);
  }
  for (const [route, html] of nonSandboxHtml) {
    if (assetReferences(html).has(style)) fail(`${route} unexpectedly loads sandbox CSS ${style}`);
  }
}

const sandboxAssets = assetReferences(sandboxHtml);
const sandboxGraph = javascriptGraph(sandboxAssets);
const nonSandboxGraph = javascriptGraph(
  nonSandboxHtml.flatMap(([, html]) => [...assetReferences(html)]),
);
const sandboxEntries = [...sandboxAssets].filter((asset) => /SandboxApp/i.test(asset));
if (sandboxEntries.length !== 1) {
  fail(`Sandbox expected one SandboxApp entry; found ${JSON.stringify(sandboxEntries)}`);
}
for (const asset of sandboxEntries) {
  if (nonSandboxGraph.has(asset)) fail(`Sandbox entry leaks into a non-sandbox graph: ${asset}`);
}
if (![...sandboxGraph].some((asset) => /SandboxApp/i.test(asset))) {
  fail('Sandbox JavaScript graph does not contain its SandboxApp entry');
}

for (const [route, html] of htmlByRoute) {
  if (route !== sandboxRoute && html.includes('SandboxApp')) {
    fail(`${route} unexpectedly references SandboxApp`);
  }
}

// --- Unlisted YKS explorer -------------------------------------------------
// The page must stay reachable only by direct URL, and its CSS/JS must not load
// anywhere else on the site.
const yksHtml = read(htmlPath(yksRoute));
const nonYksHtml = [...htmlByRoute.entries()].filter(([route]) => route !== yksRoute);

if (!yksHtml.includes('<meta name="robots" content="noindex, nofollow, noarchive">')) {
  fail(`${yksRoute} must carry a noindex, nofollow, noarchive robots directive`);
}

for (const [route, html] of nonYksHtml) {
  if (/href="(?:\/yks|https:\/\/kayisu\.github\.io\/yks)/.test(html)) {
    fail(`${route} links to the unlisted YKS page; it must not be discoverable`);
  }
}

if (existsSync(join(dist, 'sitemap-index.xml')) || existsSync(join(dist, 'sitemap-0.xml'))) {
  fail('A sitemap was generated; it would list the unlisted YKS page');
}

const yksStyles = [...stylesheetHrefs(yksHtml)].filter((href) =>
  read(href.replace(/^\//, '')).includes('.yks-shell'),
);
if (yksStyles.length !== 1) {
  fail(`YKS expected exactly one namespaced stylesheet; found ${JSON.stringify(yksStyles)}`);
}
for (const style of yksStyles) {
  for (const [route, html] of nonYksHtml) {
    if (assetReferences(html).has(style)) fail(`${route} unexpectedly loads YKS CSS ${style}`);
  }
}

const yksAssets = assetReferences(yksHtml);
const yksGraph = javascriptGraph(yksAssets);
const nonYksGraph = javascriptGraph(nonYksHtml.flatMap(([, html]) => [...assetReferences(html)]));
const yksEntries = [...yksAssets].filter((asset) => /YksApp/i.test(asset));
if (yksEntries.length !== 1) {
  fail(`YKS expected one YksApp entry; found ${JSON.stringify(yksEntries)}`);
}
for (const asset of yksEntries) {
  if (nonYksGraph.has(asset)) fail(`YKS entry leaks into another route's graph: ${asset}`);
}
if (![...yksGraph].some((asset) => /YksApp/i.test(asset))) {
  fail('YKS JavaScript graph does not contain its YksApp entry');
}
if ([...yksGraph].some((asset) => /three|SolarApp|SandboxApp/i.test(asset))) {
  fail('YKS page must not ship the solar-system or sandbox bundles');
}

for (const [route, html] of nonYksHtml) {
  if (html.includes('YksApp')) fail(`${route} unexpectedly references YksApp`);
}

// The dataset totals are rendered server-side, so they prove the data layer ran.
for (const expected of [
  '<strong>225</strong><span>uygun Tıp programı</span>',
  '<strong>104</strong><span>devlet programı</span>',
  '<strong>112</strong><span>vakıf programı</span>',
]) {
  if (!yksHtml.includes(expected)) fail(`${yksRoute} is missing rendered summary data: ${expected}`);
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const href = decodeAttribute(match[1]);
    if (!targetExists(file, href)) {
      fail(`${relative(dist, file)} contains an unresolved internal link: ${href}`);
    }
  }
}

const notFound = read('404.html');
if (!notFound.includes('<meta name="robots" content="noindex, nofollow">')) {
  fail('/404.html must be noindex');
}

if (errors.length > 0) {
  console.error(`Build verification failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Build verification passed for ${htmlFiles.length} generated HTML files.`);
