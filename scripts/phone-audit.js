// Phone-width layout audit. Run with the dev server up (`npm start`), then
// `npm run audit:phone`. Seeds localStorage from phone-audit-seed.json, visits
// every screen at 360x780 with touch emulation, screenshots each one to
// scripts/phone-audit-shots/, and exits 1 on horizontal overflow, a tap target
// under 44px, reading text under 14px, or a page error. Uses the installed Microsoft Edge, so there is
// no browser download.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, 'phone-audit-shots');
const SEED = JSON.parse(fs.readFileSync(path.join(__dirname, 'phone-audit-seed.json'), 'utf8'));
const MIN_TARGET = 44;
const MIN_TEXT_PX = 14;

const ROUTES = [
  ['home', '/'],
  ['patients', '/patients'],
  ['patient-detail', '/patients/p1'],
  ['patient-new', '/patients/new'],
  ['patient-edit', '/patients/p1/edit'],
  ['session-detail', '/sessions/s1'],
  ['session-detail-amended', '/sessions/s2'],
  ['wizard', '/sessions/new/p1/subjective?referrer=home'],
  ['schools', '/schools'],
  ['school-detail', '/schools/sch1'],
  ['school-new', '/schools/new'],
  ['settings', '/settings'],
  ['profile', '/settings/profile'],
  ['recently-deleted', '/recently-deleted'],
];

const problems = [];

const check = async (page, name) => {
  await page.waitForTimeout(300);
  const result = await page.evaluate(({ min, minText }) => {
    const doc = document.documentElement;
    const small = [...document.querySelectorAll('button, a, input, select')]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        // Inline links inside a sentence are exempt; the rule is for controls
        if (el.tagName === 'A' && style.display === 'inline' && el.closest('p')) return false;
        // Checkboxes and radios are measured by their label, not the box
        if (el.tagName === 'INPUT' && ['checkbox', 'radio', 'file', 'hidden'].includes(el.type)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < min || r.width < min);
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const text = (el.innerText || el.getAttribute('aria-label') || el.placeholder || el.type || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        return `${el.tagName.toLowerCase()} "${text}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
    // Reading text: any element whose own text is under the minimum, except
    // badges (rounded-full), the tab bar labels, and screen-reader-only text
    const smallText = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!ownText || el.closest('.rounded-full, nav[aria-label="Main"], .sr-only, option')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(el).fontSize) < minText;
      })
      .map((el) => `${parseFloat(getComputedStyle(el).fontSize)}px "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}"`);
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, small, smallText };
  }, { min: MIN_TARGET, minText: MIN_TEXT_PX });

  // Sticky bars land mid-image in a full-page shot taken while scrolled
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

  const lines = [];
  if (result.scrollWidth > result.clientWidth) {
    lines.push(`OVERFLOW ${result.scrollWidth}`);
    problems.push(`${name}: overflow ${result.scrollWidth}`);
  }
  if (result.small.length) {
    lines.push(`SMALL ${result.small.join(' | ')}`);
    problems.push(`${name}: ${result.small.length} small targets`);
  }
  if (result.smallText.length) {
    lines.push(`TEXT ${[...new Set(result.smallText)].join(' | ')}`);
    problems.push(`${name}: ${result.smallText.length} small text`);
  }
  console.log(`${name.padEnd(28)} ${lines.length ? lines.join('  ') : 'ok'}`);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  // Seed once per context; later navigations keep whatever the app wrote
  await context.addInitScript((seed) => {
    if (!sessionStorage.getItem('__auditSeeded')) {
      localStorage.clear();
      localStorage.setItem('ptAppData', JSON.stringify(seed.data));
      localStorage.setItem('pt-app-profile', JSON.stringify(seed.profile));
      localStorage.setItem('pt-app-meta', JSON.stringify(seed.meta));
      sessionStorage.setItem('__auditSeeded', '1');
    }
  }, SEED);

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  for (const [name, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await check(page, name);
  }

  // Wizard: walk every step to Review
  await page.goto(BASE + '/sessions/new/p1/subjective?referrer=home', { waitUntil: 'networkidle' });
  const start = page.getByRole('button', { name: /^start session/i });
  if (await start.count()) await start.first().click();
  const steps = ['subjective', 'objective', 'assessment', 'plan'];
  for (let i = 0; i < steps.length; i++) {
    const textarea = page.locator('textarea').first();
    if (await textarea.count()) await textarea.fill(`Audit text for the ${steps[i]} section.`);
    if (steps[i] === 'objective') {
      const category = page.getByText('Balance & Coordination').first();
      if (await category.count()) await category.click();
    }
    await check(page, `wizard-${i + 1}-${steps[i]}`);
    await page.getByRole('button', { name: /continue/i }).last().click();
  }
  await check(page, 'wizard-5-review');

  // Note page: export modal, then edit mode, then the delete confirm
  await page.goto(BASE + '/sessions/s1', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /download/i }).first().click();
  await check(page, 'session-export-modal');
  await page.getByRole('button', { name: /^cancel$/i }).first().click();
  await page.getByRole('button', { name: /^edit$/i }).first().click();
  await check(page, 'session-edit-mode');
  await page.getByRole('button', { name: /^cancel$/i }).first().click();
  try {
    await page.getByRole('button', { name: /delete/i }).first().click({ timeout: 5000 });
    await check(page, 'session-delete-confirm');
  } catch (error) {
    console.log(`${'session-delete-confirm'.padEnd(28)} UNTAPPABLE the Delete button could not be clicked`);
    problems.push('session-delete-confirm: Delete button not tappable');
  }

  // A live toast must not cover the wizard's primary button. Copy-forward
  // shows an info toast on arrival; each button's center must be the button.
  await page.goto(BASE + '/sessions/new/p1/subjective?referrer=profile&copyFrom=s1', { waitUntil: 'networkidle' });
  const discardDraft = page.getByRole('button', { name: /^discard$/i });
  if (await discardDraft.count()) await discardDraft.click();
  await page.getByText(/Prefilled from the/).waitFor({ timeout: 5000 });
  const covered = await page.evaluate(() => {
    const blocked = [];
    for (const button of document.querySelectorAll('button')) {
      if (!/continue|save/i.test(button.innerText)) continue;
      const r = button.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !button.contains(hit)) blocked.push(`"${button.innerText.trim()}" under "${(hit.innerText || hit.tagName).trim().slice(0, 30)}"`);
    }
    return blocked;
  });
  if (covered.length) {
    console.log(`${'wizard-toast'.padEnd(28)} COVERED ${covered.join(' | ')}`);
    problems.push(`wizard-toast: ${covered.length} buttons covered by a toast`);
  } else {
    await check(page, 'wizard-toast');
  }

  // Home: the three-dot menu
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /patient actions/i }).first().click();
  await check(page, 'home-actions-menu');

  await browser.close();

  if (pageErrors.length) {
    console.log('\nPAGE ERRORS:\n' + pageErrors.join('\n'));
    problems.push(`${pageErrors.length} page errors`);
  }
  console.log(`\nScreenshots: ${OUT}`);
  if (problems.length) {
    console.log(`FAIL: ${problems.length} problems`);
    process.exit(1);
  }
  console.log('PASS: no overflow, no small targets, no small text, no page errors');
})().catch((error) => {
  console.error(error.message.split('\n')[0]);
  process.exit(1);
});
