import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const origin = 'https://kayisu.github.io';
const errors = [];
const fail = (message) => errors.push(message);

function htmlPath(route) {
  if (route === '/') return 'index.html';
  if (route === '/404.html') return '404.html';
  return `${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

function routeForHtml(file) {
  const path = relative(dist, file).replaceAll('\\', '/');
  if (path === 'index.html') return '/';
  if (path === '404.html') return '/404.html';
  return `/${path.replace(/index\.html$/, '')}`;
}

function read(route) {
  const file = join(dist, htmlPath(route));
  if (!existsSync(file)) {
    fail(`Missing generated file: ${htmlPath(route)}`);
    return '';
  }
  return readFileSync(file, 'utf8');
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function decodeAttribute(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
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
    } catch { /* Fall through to the component URL. */ }
  }
  return tag.match(/\bcomponent-url="([^"]+)"/)?.[1]?.split('/').pop()?.split('.')[0] ?? 'unknown';
}

function assertIsland(route, expectedName) {
  const names = islandTags(read(route)).map(islandName);
  if (names.length !== 1 || names[0] !== expectedName) {
    fail(`${route} expected one ${expectedName} island; found ${JSON.stringify(names)}`);
  }
}

function assertStatic(route) {
  const names = islandTags(read(route)).map(islandName);
  if (names.length) fail(`${route} must be static; found ${names.join(', ')}`);
}

function assertMetadata(route, locale, canonical, alternates = {}) {
  const html = read(route);
  if (!new RegExp(`<html[^>]+lang="${locale}"`).test(html)) fail(`${route} does not declare lang=${locale}`);
  if (!html.includes(`<link rel="canonical" href="${origin}${canonical}">`)) fail(`${route} has an incorrect or missing canonical URL`);
  for (const [language, href] of Object.entries(alternates)) {
    if (!html.includes(`<link rel="alternate" hreflang="${language}" href="${origin}${href}">`)) {
      fail(`${route} is missing alternate ${language} -> ${href}`);
    }
  }
}

function assertRedirect(route, destination) {
  const html = read(route);
  const content = html.match(/<meta\s+http-equiv="refresh"\s+content="([^"]+)"/i)?.[1];
  const redirect = decodeAttribute(content ?? '');
  if (!content || !redirect.includes(`url=${destination}`)) {
    fail(`${route} is missing its redirect to ${destination}`);
  }
}

function attributeValues(html, attribute) {
  const pattern = new RegExp(`\\b${attribute}="([^"]+)"`, 'g');
  return [...html.matchAll(pattern)].map((match) => decodeAttribute(match[1]));
}

function assetReferences(html) {
  return new Set(['href', 'src', 'component-url', 'renderer-url', 'before-hydration-url']
    .flatMap((attribute) => attributeValues(html, attribute))
    .filter((value) => value.startsWith('/_astro/')));
}

function stylesheetHrefs(html) {
  return new Set([...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .map((match) => decodeAttribute(match[1]))
    .filter((href) => href.startsWith('/')));
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
  while (queue.length) {
    const asset = queue.shift();
    if (graph.has(asset)) continue;
    graph.add(asset);
    for (const imported of javascriptImports(asset)) if (!graph.has(imported)) queue.push(imported);
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

function targetExists(fromFile, href) {
  if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) return true;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return false;
  const base = new URL(routeForHtml(fromFile), origin);
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
const universeRoutes = ['/', '/en/'];
const sandboxRoute = '/sandstruction/';
const yksRoute = '/yks/2026/tip-tercih/';
const projectSlugs = ['cognispace', 'ecoreport', 'sorudepo', 'sandstruction', 'yks-tercih-sihirbazi', 'wordloom', 'statsview'];

for (const route of universeRoutes) assertIsland(route, 'UniverseApp');
assertIsland(sandboxRoute, 'SandboxApp');
assertIsland(yksRoute, 'YksApp');

const interactiveRoutes = [...universeRoutes, sandboxRoute, yksRoute];
for (const route of htmlByRoute.keys()) if (!interactiveRoutes.includes(route)) assertStatic(route);

assertMetadata('/', 'tr', '/', { tr: '/', en: '/en/', 'x-default': '/' });
assertMetadata('/en/', 'en', '/en/', { tr: '/', en: '/en/', 'x-default': '/' });
assertMetadata('/about/', 'tr', '/about/', { tr: '/about/', en: '/en/about/', 'x-default': '/about/' });
assertMetadata('/en/about/', 'en', '/en/about/', { tr: '/about/', en: '/en/about/', 'x-default': '/about/' });
for (const slug of projectSlugs) {
  assertMetadata(`/projects/${slug}/`, 'tr', `/projects/${slug}/`, {
    tr: `/projects/${slug}/`, en: `/en/projects/${slug}/`, 'x-default': `/projects/${slug}/`,
  });
  assertMetadata(`/en/projects/${slug}/`, 'en', `/en/projects/${slug}/`, {
    tr: `/projects/${slug}/`, en: `/en/projects/${slug}/`, 'x-default': `/projects/${slug}/`,
  });
  for (const route of [`/projects/${slug}/`, `/en/projects/${slug}/`]) {
    const html = read(route);
    if (html.includes('UniverseApp')) fail(`${route} unexpectedly references UniverseApp`);
  }
}
assertMetadata(sandboxRoute, 'tr', sandboxRoute);
assertMetadata(yksRoute, 'tr', yksRoute);
assertMetadata('/404.html', 'tr', '/404.html');

const oldPlanets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const redirects = [
  ['/tr/', '/'], ['/explore/', '/'], ['/tr/explore/', '/'],
  ['/star/sun/', '/en/about/'], ['/tr/star/sun/', '/about/'],
  ['/planet/earth/games/', '/sandstruction/'], ['/planet/earth/games/sandbox/', '/sandstruction/'],
  ['/tr/planet/earth/games/', '/sandstruction/'],
  ['/projects/sandcastle-sandbox/', '/projects/sandstruction/'], ['/tr/projects/sandcastle-sandbox/', '/projects/sandstruction/'],
  ['/en/projects/sandcastle-sandbox/', '/en/projects/sandstruction/'],
  ...oldPlanets.flatMap((planet) => [[`/planet/${planet}/`, '/en/'], [`/tr/planet/${planet}/`, '/']]),
  ...projectSlugs.filter((slug) => !['sandstruction', 'wordloom', 'statsview'].includes(slug)).map((slug) => [`/tr/projects/${slug}/`, `/projects/${slug}/`]),
];
for (const [route, destination] of redirects) assertRedirect(route, destination);

const trHome = read('/');
const enHome = read('/en/');
for (const route of ['/', '/en/', '/about/', '/en/about/']) {
  if (read(route).includes('[[KAAN]]')) fail(`${route} leaks the profile statement placeholder`);
}
for (const [route, html] of [['/about/', read('/about/')], ['/en/about/', read('/en/about/')]]) {
  for (const expected of ['Sera', 'CogniSpace']) if (!html.includes(expected)) fail(`${route} is missing profile content: ${expected}`);
}
if (!trHome.includes('Emre Kaan Ataş') || !enHome.includes('Emre Kaan Ataş')) fail('A universe route is missing the owner name.');
if (!read('/404.html').includes('Page not found.') || !read('/404.html').includes('Sayfa bulunamadı.')) {
  fail('/404.html must include one not-found line for each language.');
}

for (const absent of [
  'projects/unknown/index.html', 'en/projects/unknown/index.html',
  'planet/unknown/index.html',
]) if (existsSync(join(dist, absent))) fail(`Unexpected route was generated: ${absent}`);

// --- Sandbox asset boundary ------------------------------------------------
const sandboxHtml = read(sandboxRoute);
const sandboxStyles = [...stylesheetHrefs(sandboxHtml)].filter((href) => /sandbox|sandstruction/i.test(href));
if (!sandboxStyles.length) fail('Sandbox has no identifiable route stylesheet');
const nonSandboxHtml = [...htmlByRoute.entries()].filter(([route]) => route !== sandboxRoute);
for (const style of sandboxStyles) {
  if (!readFileSync(join(dist, style.replace(/^\//, '')), 'utf8').includes('.sandbox-shell')) {
    fail(`Sandbox stylesheet does not contain the sandbox namespace: ${style}`);
  }
  for (const [route, html] of nonSandboxHtml) if (assetReferences(html).has(style)) fail(`${route} unexpectedly loads sandbox CSS ${style}`);
}
const sandboxAssets = assetReferences(sandboxHtml);
const sandboxGraph = javascriptGraph(sandboxAssets);
const nonSandboxGraph = javascriptGraph(nonSandboxHtml.flatMap(([, html]) => [...assetReferences(html)]));
const sandboxEntries = [...sandboxAssets].filter((asset) => /SandboxApp/i.test(asset));
if (sandboxEntries.length !== 1) fail(`Sandbox expected one SandboxApp entry; found ${JSON.stringify(sandboxEntries)}`);
for (const asset of sandboxEntries) if (nonSandboxGraph.has(asset)) fail(`Sandbox entry leaks into another route's graph: ${asset}`);
if (![...sandboxGraph].some((asset) => /SandboxApp/i.test(asset))) fail('Sandbox JavaScript graph does not contain its SandboxApp entry');
for (const [route, html] of htmlByRoute) if (route !== sandboxRoute && html.includes('SandboxApp')) fail(`${route} unexpectedly references SandboxApp`);

// --- YKS explorer ----------------------------------------------------------
const yksHtml = read(yksRoute);
const nonYksHtml = [...htmlByRoute.entries()].filter(([route]) => route !== yksRoute);
const yksStyles = [...stylesheetHrefs(yksHtml)].filter((href) => readFileSync(join(dist, href.replace(/^\//, '')), 'utf8').includes('.yks-shell'));
if (yksStyles.length !== 1) fail(`YKS expected exactly one namespaced stylesheet; found ${JSON.stringify(yksStyles)}`);
for (const style of yksStyles) for (const [route, html] of nonYksHtml) {
  if (assetReferences(html).has(style)) fail(`${route} unexpectedly loads YKS CSS ${style}`);
}
const yksAssets = assetReferences(yksHtml);
const yksGraph = javascriptGraph(yksAssets);
const nonYksGraph = javascriptGraph(nonYksHtml.flatMap(([, html]) => [...assetReferences(html)]));
const yksEntries = [...yksAssets].filter((asset) => /YksApp/i.test(asset));
if (yksEntries.length !== 1) fail(`YKS expected one YksApp entry; found ${JSON.stringify(yksEntries)}`);
for (const asset of yksEntries) if (nonYksGraph.has(asset)) fail(`YKS entry leaks into another route's graph: ${asset}`);
if (![...yksGraph].some((asset) => /YksApp/i.test(asset))) fail('YKS JavaScript graph does not contain its YksApp entry');
if ([...yksGraph].some((asset) => /three|SolarApp|SandboxApp/i.test(asset))) fail('YKS page must not ship the solar-system or sandbox bundles');
for (const [route, html] of nonYksHtml) if (html.includes('YksApp')) fail(`${route} unexpectedly references YksApp`);
for (const expected of [
  '<strong>225</strong><span>uygun Tıp programı</span>',
  '<strong>104</strong><span>devlet programı</span>',
  '<strong>112</strong><span>vakıf programı</span>',
]) if (!yksHtml.includes(expected)) fail(`${yksRoute} is missing rendered summary data: ${expected}`);

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const href = decodeAttribute(match[1]);
    if (!targetExists(file, href)) fail(`${relative(dist, file)} contains an unresolved internal link: ${href}`);
  }
}
if (!read('/404.html').includes('<meta name="robots" content="noindex, nofollow">')) fail('/404.html must be noindex');

if (errors.length) {
  console.error(`Build verification failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Build verification passed for ${htmlFiles.length} generated HTML files.`);
