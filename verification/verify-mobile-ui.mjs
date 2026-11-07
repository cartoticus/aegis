/**
 * Interface suite — touch vs mouse, phone vs desktop (v1.6.1).
 *
 * Two of the three day-one dogfood bugs were phone-only, and the header turned
 * out never to have fitted a phone at all. The rules this suite follows, each
 * learned the hard way:
 *
 *   - SWEEP widths, don't test the reported one. 390px alone passed a fix that
 *     broke every narrower phone.
 *   - ASSERT BOTH HALVES of a layout trade-off. An element overlapping its
 *     neighbour and the page scrolling sideways are the same overflow spent two
 *     ways; checking one alone always passes some wrong fix.
 *   - An assertion only counts if it FAILS when the thing it names is gone. A
 *     check the base case already satisfies is inert (e.g. "the tooltip is
 *     display:none" — the base rule already says so).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const ROOT = process.env.APP_ROOT || import.meta.dirname + '/../';
const PORT = Number(process.env.PORT_BASE || 8811);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const n = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  let b; try { b = readFileSync(ROOT + n); } catch { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(b);
}).listen(PORT);
const URL = `http://127.0.0.1:${PORT}/index.html`;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };

const browser = await chromium.launch();
const errors = [];

/* A fresh page per scenario. lastSeenVersion is pre-set so the What's New
   modal does not sit on top of everything being measured. */
async function open({ width = 390, height = 844, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('aegis.state.v1', JSON.stringify({ lastSeenVersion: '__test__' })); } catch {}
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(() => { state.lastSeenVersion = APP_VERSION; closeWhatsNew(); });
  return { ctx, page };
}

/* ══ 1. Glossary tooltip — touch ═══════════════════════════════════════════ */
{
  const { ctx, page } = await open({ touch: true });
  const hover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
  ok('touch context really reports no hover (else this section proves nothing)', hover === false);

  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  const g = page.locator('#domPanels .dom-panel.active .gloss').first();
  ok('a glossary term is present to test against', await g.count() === 1);

  // JS layer: a mouseover on a hover-less device must not even try to show it.
  // Read the INLINE style the handler writes — independent of the CSS belt.
  const jsGuard = await page.evaluate(() => {
    const el = document.querySelector('#domPanels .dom-panel.active .gloss');
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.getElementById('glossTip');
    return { inline: tip.style.display, shown: tip.classList.contains('show') };
  });
  ok('touch: hover handler does not show the tooltip (JS guard)', jsGuard.inline !== 'block' && !jsGuard.shown, JSON.stringify(jsGuard));

  // CSS layer: force the strongest a script can push and require the media query
  // to still win. "display:none" alone would pass with the belt deleted, because
  // the base rule already sets it — that assertion escaped once already.
  const cssBelt = await page.evaluate(() => {
    const tip = document.getElementById('glossTip');
    tip.classList.add('show'); tip.style.display = 'block';
    const d = getComputedStyle(tip).display;
    tip.classList.remove('show'); tip.style.display = 'none';
    return d;
  });
  ok('touch: stylesheet hides a forced tooltip (CSS belt)', cssBelt === 'none', cssBelt);

  await g.tap();
  const afterTap = await page.evaluate(() => ({
    modal: document.getElementById('termOverlay').classList.contains('show'),
    tip: getComputedStyle(document.getElementById('glossTip')).display,
  }));
  ok('touch: tapping a term opens the full entry', afterTap.modal === true);
  ok('touch: no stray tooltip over the open entry', afterTap.tip === 'none', afterTap.tip);
  await ctx.close();
}

/* ══ 2. Glossary tooltip — mouse (must be unchanged) ═══════════════════════ */
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  const g = page.locator('#domPanels .dom-panel.active .gloss').first();
  await g.hover();
  const shown = await page.evaluate(() => {
    const t = document.getElementById('glossTip');
    return { display: getComputedStyle(t).display, text: t.textContent };
  });
  ok('mouse: hover shows the tooltip', shown.display === 'block', shown.display);
  ok('mouse: tooltip carries the definition', shown.text.length > 20, shown.text);

  await page.mouse.move(5, 5);
  ok('mouse: moving off hides it', await page.evaluate(() => getComputedStyle(document.getElementById('glossTip')).display) === 'none');

  // openTerm() must dismiss as its first action. Show it, then open the entry
  // without moving the mouse off the term (the touch path, on a mouse).
  await g.hover();
  ok('precondition: tooltip visible before openTerm', await page.evaluate(() => getComputedStyle(document.getElementById('glossTip')).display === 'block'));
  await page.evaluate(() => openTerm(document.querySelector('#domPanels .dom-panel.active .gloss').dataset.term));
  ok('opening a term dismisses a visible tooltip', await page.evaluate(() => document.getElementById('glossTip').style.display) === 'none');
  await page.evaluate(() => closeTerm());

  // Each dismissal check first proves the tooltip is VISIBLE — otherwise it
  // passes on a tooltip that was never shown (the mouse already sat on the
  // term, so a second hover() fired no mouseover; T6 escaped exactly so).
  const reshow = async () => { await page.mouse.move(5, 5); await g.hover();
    return page.evaluate(() => getComputedStyle(document.getElementById('glossTip')).display === 'block'); };
  ok('precondition: tooltip visible before tap-elsewhere', await reshow());
  await page.evaluate(() => document.querySelector('.hero').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  ok('tap elsewhere dismisses the tooltip', await page.evaluate(() => document.getElementById('glossTip').style.display) === 'none');

  ok('precondition: tooltip visible before scroll', await reshow());
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  ok('scrolling dismisses the tooltip', await page.evaluate(() => document.getElementById('glossTip').style.display) === 'none');
  await ctx.close();
}

/* ══ 3. Domains objective row ══════════════════════════════════════════════
   Measured on the first Domain 1 row (Beginner, with a Learn button). */
const rowGeom = page => page.evaluate(() => {
  const label = document.querySelector('#domPanels .dom-panel.active .obj');
  const title = label.querySelector(':scope > span:first-of-type');
  const btn = label.querySelector('.learn-btn');
  const box = e => e.getBoundingClientRect();
  const L = box(label), T = box(title), B = box(btn);
  const cs = getComputedStyle(label);
  const inner = L.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return { rowH: L.height, titleW: T.width, inner, titleBottom: T.bottom, btnTop: B.top,
           btnH: B.height, btnW: B.width, cbLeft: box(label.querySelector('input')).left, titleLeft: T.left,
           scrollW: document.documentElement.scrollWidth, vw: innerWidth };
});

for (const width of [300, 320, 360, 390]) {
  const { ctx, page } = await open({ width });
  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  const r = await rowGeom(page);
  ok(`row @${width}: title takes the full row`, r.titleW >= r.inner - 1, JSON.stringify(r));
  ok(`row @${width}: buttons sit below the title`, r.btnTop >= r.titleBottom - 1, JSON.stringify(r));
  ok(`row @${width}: title indented past the checkbox`, r.titleLeft > r.cbLeft + 10, JSON.stringify(r));
  ok(`row @${width}: buttons are tappable (>=28px)`, r.btnH >= 28, String(r.btnH));
  ok(`row @${width}: no horizontal page scroll`, r.scrollW <= r.vw, `${r.scrollW} > ${r.vw}`);
  if (width === 390) ok('row @390: shorter than the v1.6.0 122px', r.rowH < 110, String(r.rowH));
  await ctx.close();
}

// A SHORT title fills its own line anyway, so "takes the full row" looks
// redundant on a long one. Only a short title exposes the rule.
{
  const { ctx, page } = await open({ width: 390 });
  await page.evaluate(() => { switchView('domains'); selectDomain(0);
    document.querySelector('#domPanels .dom-panel.active .obj > span:first-of-type').textContent = 'CIA'; });
  const r = await rowGeom(page);
  ok('row: even a one-word title claims the row', r.titleW >= r.inner - 1 && r.btnTop >= r.titleBottom - 1, JSON.stringify(r));
  await ctx.close();
}

// Desktop: the three-column grid gives this column ~340px at 1280 — narrow, so it reflows.
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  const r = await rowGeom(page);
  ok('row @1280 (narrow column inside a wide window): reflows', r.btnTop >= r.titleBottom - 1, JSON.stringify(r));
  ok('row @1280: button width capped (no 250px chip)', r.btnW <= 181, String(r.btnW));
  await ctx.close();
}
// Below 880px the grid collapses: an 800px window has a ~750px column, which
// must stay on ONE line. This is what separates a container query from a
// viewport query that happens to agree at phone widths.
{
  const { ctx, page } = await open({ width: 800, height: 900 });
  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  const r = await rowGeom(page);
  ok('row @800 (wide column inside a narrow window): stays on one line', r.btnTop < r.titleBottom, JSON.stringify(r));
  await ctx.close();
}

/* ══ 4. Header ═════════════════════════════════════════════════════════════ */
const headGeom = page => page.evaluate(() => {
  const box = s => document.querySelector(s).getBoundingClientRect();
  const name = box('.wordmark .name'), sub = box('.wordmark .sub'), streak = box('.streak'), rank = box('.rank-chip');
  const subEl = document.querySelector('.wordmark .sub');
  const lh = parseFloat(getComputedStyle(subEl).lineHeight) || parseFloat(getComputedStyle(subEl).fontSize) * 1.2;
  return {
    brandRight: Math.max(name.right, sub.right), streakLeft: streak.left, streakRight: streak.right, rankLeft: rank.left,
    subLines: Math.round(sub.height / lh), subText: subEl.innerText.trim(),
    topbarH: box('.topbar').height, scrollW: document.documentElement.scrollWidth, vw: innerWidth,
  };
});
for (const width of [300, 320, 360, 390, 420, 480, 768, 1024, 1280]) {
  const { ctx, page } = await open({ width });
  const h = await headGeom(page);
  ok(`header @${width}: wordmark does not slide under the streak`, h.brandRight <= h.streakLeft + 0.5, JSON.stringify(h));
  ok(`header @${width}: streak does not overlap readiness`, h.streakRight <= h.rankLeft + 0.5, JSON.stringify(h));
  ok(`header @${width}: no horizontal page scroll`, h.scrollW <= h.vw, `${h.scrollW} > ${h.vw}`);
  ok(`header @${width}: version badge on one line`, h.subLines <= 1, JSON.stringify(h));
  ok(`header @${width}: version still readable`, /v\d+\.\d+\.\d+/i.test(h.subText), h.subText);
  ok(`header @${width}: bar is one row`, h.topbarH < 80, String(h.topbarH));
  await ctx.close();
}

await browser.close();
server.close();
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log('\nInterface — touch vs mouse, 300px → 1280px');
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
