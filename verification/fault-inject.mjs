/**
 * Fault injection — does each fix actually have a test that notices it is gone?
 *
 * A green suite you have never broken on purpose may be inert. For every fault
 * below, this copies the app into a temp dir, reverts ONE fix in index.html, runs
 * the suite that is supposed to catch it, and requires that suite to FAIL.
 * An "escape" (suite still green) means a test is asserting something the base
 * case already satisfies — fix the test, not the fault list.
 *
 *   npm run test:faults            # all faults
 *   npm run test:faults -- C H8    # only faults whose id starts with C or H8
 *
 * When you add a fix, add its fault here. Patterns must match exactly; a pattern
 * that no longer matches is reported as BROKEN (the fix moved — update the fault).
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const SRC = readFileSync(join(REPO, 'index.html'), 'utf8');
const LOOP = 'verification/verify-arc-loop.mjs', UI = 'verification/verify-mobile-ui.mjs';

// The last release that shipped the reorder bug. Pinned, so this fault keeps
// meaning "the real v1.6.0" after later releases. Needs non-shallow history.
const V160_COMMIT = '5abdf43';
const v160 = () => execFileSync('git', ['-C', REPO, 'show', `${V160_COMMIT}:index.html`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const sub = (old, neu) => s => {
  if (!s.includes(old)) throw new Error('pattern not found: ' + JSON.stringify(old.slice(0, 70)));
  return s.split(old).join(neu);
};
const both = (...fs) => s => fs.reduce((acc, f) => f(acc), s);

const ROOM = '.sub-tag,.streak-unit,.rank-chip .rk-name{display:none}';
const HOVER_JS = "if(!matchMedia('(hover: hover)').matches)return;";
const HOVER_CSS = '@media(hover:none){#glossTip{display:none!important}}';

const FAULTS = [
  // ── v1.6.1 · reorder drills (loop suite, section D2) ──
  ['A',  'drill reset back to draft=null',          LOOP, sub("arcDraftSite('drill:'+drill.id);", 'ARC_UI.draft=null;')],
  ['B',  'drill rerender back to full renderArc',   LOOP, sub("{const w=$('#arcWidget');arcWireWidget(drill,w,()=>arcRedrawWidget(drill,w));}", "arcWireWidget(drill,$('#arcWidget'),()=>renderArc());")],
  ['C',  'the exact v1.6.0 index.html',             LOOP, () => v160()],
  ['D',  'gate rerender back to full renderArc',    LOOP, sub('arcWireWidget(gate,w,()=>arcRedrawWidget(gate,w));', 'arcWireWidget(gate,w,()=>{renderArc();});')],
  ['E',  'arcDraftSite clears unconditionally',     LOOP, sub('if(ARC_UI.draftFor===key)return;', '')],
  ['F',  'focus restoration removed',               LOOP, sub('if(b)b.focus();', '')],
  ['G',  'move announcement removed',               LOOP, sub('if(live)live.textContent=', 'if(0)live.textContent=')],
  ['H',  'edge buttons not disabled',               LOOP, both(sub("${i===0?'disabled':''}", ''), sub("${i===n-1?'disabled':''}", ''))],
  // ── v1.6.1 · glossary tooltip (interface suite) ──
  ['T1', 'JS hover guard removed',                  UI, sub(HOVER_JS, '')],
  ['T2', 'CSS hover belt removed',                  UI, sub(HOVER_CSS, '')],
  ['T3', 'both tooltip layers removed',             UI, both(sub(HOVER_JS, ''), sub(HOVER_CSS, ''))],
  ['T4', 'openTerm no longer dismisses',            UI, sub('function openTerm(slug){\n  hideGlossTip();', 'function openTerm(slug){')],
  ['T5', 'tap-elsewhere dismissal removed',         UI, sub("document.addEventListener('pointerdown',e=>{if(!(e.target.closest&&e.target.closest('.gloss')))hideGlossTip();},true);", '')],
  ['T6', 'scroll dismissal removed',                UI, sub("window.addEventListener('scroll',hideGlossTip,{passive:true,capture:true});", '')],
  // ── v1.6.1 · objective rows ──
  ['L1', 'row no longer wraps',                     UI, sub('.obj{flex-wrap:wrap;', '.obj{')],
  ['L2', 'checkbox back in flow',                   UI, sub('.obj input{position:absolute;left:0;top:0}', '')],
  ['L3', 'title no longer claims the row',          UI, sub('.obj > span:first-of-type{flex:0 0 100%}', '')],
  ['L4', 'buttons stay small',                      UI, sub('margin:0;padding:8px 10px;text-align:center}', 'margin:0;text-align:center}')],
  ['C1', 'container-type removed',                  UI, sub('.obj-list{container-type:inline-size}', '')],
  ['C2', 'container query -> viewport query',       UI, sub('@container (max-width:420px){', '@media (max-width:420px){')],
  // ── v1.6.1 · header ──
  ['H3', 'chips keep their labels',                 UI, sub(ROOM, '.sub-tag{display:none}')],
  ['H4', 'tagline kept on a phone',                 UI, sub(ROOM, '.streak-unit,.rank-chip .rk-name{display:none}')],
  ['H6', 'all room-makers removed',                 UI, sub(ROOM, '')],
  ['H7', 'version badge allowed to wrap',           UI, sub('.wordmark .sub{white-space:nowrap}', '')],
  ['H8', 'brand pinned instead of making room',     UI, sub(ROOM, '.brand{flex:none}')],
];

const only = process.argv.slice(2);
const todo = FAULTS.filter(([id]) => !only.length || only.some(o => id === o || id.startsWith(o)));
const APP_FILES = ['index.html', 'sw.js', 'arc-core.mjs', 'manifest.webmanifest', 'outline-versions.json', 'modules', 'icons'];

function runOne([id, name, suite, mutate], port) {
  return new Promise(resolve => {
    let html;
    try { html = mutate(SRC); }
    catch (e) { return resolve({ id, name, status: 'BROKEN', detail: e.message.split('\n')[0] }); }
    const dir = mkdtempSync(join(tmpdir(), `aegis-fault-${id}-`));
    for (const f of APP_FILES) if (existsSync(join(REPO, f))) cpSync(join(REPO, f), join(dir, f), { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    const p = spawn('node', [suite], { cwd: REPO, env: { ...process.env, APP_ROOT: dir + '/', PORT_BASE: String(port) } });
    let out = '';
    p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (out += d));
    const kill = setTimeout(() => p.kill('SIGKILL'), 400_000);
    p.on('close', code => {
      clearTimeout(kill); rmSync(dir, { recursive: true, force: true });
      const caught = out.split('\n').map(l => l.trim()).filter(l => l.startsWith('✗'));
      resolve({ id, name, status: code === 0 ? 'ESCAPED' : 'CAUGHT', n: caught.length, first: caught[0] || out.trim().split('\n').at(-1) });
    });
  });
}

// Small pool: the suites each launch Chromium, so keep parallelism modest.
const POOL = Number(process.env.FAULT_JOBS || 3);
const results = []; let next = 0;
await Promise.all(Array.from({ length: Math.min(POOL, todo.length) }, async (_, w) => {
  while (next < todo.length) {
    const f = todo[next++];
    const r = await runOne(f, 9100 + w * 10);
    results.push(r);
    const tag = { CAUGHT: 'CAUGHT ', ESCAPED: 'ESCAPED', BROKEN: 'BROKEN ' }[r.status];
    console.log(`${tag}  ${r.id.padEnd(3)} ${r.name}${r.status === 'CAUGHT' ? `  (${r.n} check${r.n === 1 ? '' : 's'})` : ''}`);
    if (r.status !== 'CAUGHT' && (r.detail || r.first)) console.log('         ' + String(r.detail || r.first).slice(0, 160));
  }
}));

const esc = results.filter(r => r.status === 'ESCAPED'), brk = results.filter(r => r.status === 'BROKEN');
console.log('\nFault injection');
console.log('─'.repeat(58));
console.log(`  ${results.length} faults · ${results.length - esc.length - brk.length} caught · ${esc.length} escaped · ${brk.length} broken`);
if (esc.length || brk.length) process.exit(1);
console.log('  PASS — every fix has a test that notices it is gone\n');
