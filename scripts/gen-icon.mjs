/**
 * Renders public/favicon.svg to build/icon.png (1024x1024) using Playwright.
 * Run once locally or in CI before electron-builder.
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

mkdirSync(join(root, 'build'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(`<!DOCTYPE html>
<html>
<head><style>*{margin:0;padding:0}body{width:1024px;height:1024px;overflow:hidden;background:transparent}</style></head>
<body><img src="${dataUrl}" width="1024" height="1024"/></body>
</html>`);
await page.waitForLoadState('load');
await page.screenshot({
  path: join(root, 'build/icon.png'),
  clip: { x: 0, y: 0, width: 1024, height: 1024 },
});
await browser.close();
console.log('Generated build/icon.png');
