// Static site generator for the EL3vate Day 8 site.
// Reads content/*.json + demos/, emits dist/. Plain Node, zero dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---- deployment constants ----
// SITE_URL is the ONE place the public address is written. It is printed by the
// build, logged in REPORT.md, stamped into the print stylesheet's demo
// substitution line, encoded into the QR code, and shown on the closing card.
// It must be the stable production alias, never a deployment-specific hostname
// of the form el3vate-<hash>-<team>.vercel.app — those are frozen to a single
// build, so a QR code printed from one would go stale the next time the site
// ships.
const SITE_URL = 'https://el3vate.vercel.app';
const FEEDBACK_EMAIL = 'tclum@hawaii.edu';

// Additional hostnames that resolve to the same Vercel deployment. These are
// DISPLAY ONLY — printed as plain text in the hub footer so someone handed the
// friendlier address can confirm they are in the right place. An alias is never
// substituted into SITE_URL: assets/qr.svg, dist/closing-card.html and the
// self-contained presenter kit were all generated from SITE_URL, and the
// presenter kit carries that QR inlined as a data URI, so changing SITE_URL
// silently invalidates the artifact the session is presented from.
const ALIASES = ['https://el3vate.forpono.com'];

// ---- phase 13: feedback backend kill switch ----
// One boolean is the whole escape hatch. With USE_SUPABASE false the build emits
// exactly what it emitted before phase 13 — a mailto: feedback link and nothing
// else: no form markup, no fetch, no credential, no mention of the backend
// anywhere in dist/. Flipping it back to false and re-running `./ship.sh prod` is
// the sub-two-minute revert, and GATE 11 in src/validate.js is what proves the
// emitted site actually has zero references rather than merely intending to.
//
// The two credentials are a second, independent interlock: if either is an empty
// string the switch counts as OFF no matter what USE_SUPABASE says, so a
// half-configured build can never ship a form that posts nowhere.
//
// SUPABASE_ANON_KEY takes the anonymous (publishable) key ONLY — never the
// service-role key, which bypasses row-level security and would be readable by
// anyone, since this is public static HTML. Written "service-role" with a hyphen
// deliberately: GATE 12 fails on the underscored token appearing in any tracked
// file or anywhere in dist/, and it holds that line with no prose exemption.
const USE_SUPABASE = false;              // master switch for everything in phases 13-17
const SUPABASE_URL = '';                 // filled by Tim
const SUPABASE_ANON_KEY = '';            // filled by Tim — anon key ONLY, never the service-role key

// The effective state. Every phase-15 emission is gated on this one predicate,
// never on USE_SUPABASE alone, so the credential interlock cannot be bypassed by
// a caller that forgets to check it.
const SUPABASE_ON =
  USE_SUPABASE && String(SUPABASE_URL).trim() !== '' && String(SUPABASE_ANON_KEY).trim() !== '';

// The Day 10 challenge, in one sentence, for the closing card. Nothing in the
// repo or either brief records what it is, so this was written to follow from
// the session: it asks for the one artifact the whole site is built around — a
// real model output with the error found in it. If Tim has a different
// challenge, replace this one string. See BLOCKERS.md.
const DAY10_CHALLENGE =
  'Before Day 10: run one starter prompt from your own discipline’s page against your own course material, ' +
  'and bring back the place where the model was confidently wrong.';

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DEMOS = path.join(ROOT, 'demos');
const DIST = path.join(ROOT, 'dist');

// ---- build stamp ----
let SHA = 'nogit';
try { SHA = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) {}
const ISO = new Date().toISOString();
const STAMP = `<!-- build: ${SHA} ${ISO} -->`;

// ---- helpers ----
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const escAttr = esc;

// claims.json is the phase-7 claim audit, not a discipline document — never a page.
const NOT_A_DOC = new Set(['claims.json']);

function load() {
  return fs.readdirSync(CONTENT).filter(f => f.endsWith('.json') && !NOT_A_DOC.has(f))
    .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')))
    .sort((a, b) => a.part - b.part);
}

function loadClaims() {
  const p = path.join(CONTENT, 'claims.json');
  if (!fs.existsSync(p)) return { claims: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---- phase 7: unverified-claim markers ----
// Claims audited as `unverifiable` and flagged `marker: true` are kept in the
// site but must render inside a visible marker. src/validate.js GATE 7 fails the
// build if any of them renders bare.
const CLAIMS = loadClaims();
const MARKS = {};                       // slug -> [exact substrings to mark]
for (const c of (CLAIMS.claims || [])) {
  if (c.status !== 'unverifiable' || !c.marker) continue;
  for (const s of (c.markedSpans || [])) {
    const slug = path.basename(s.file, '.json');
    (MARKS[slug] = MARKS[slug] || []).push(s.text);
  }
}
const hasMarks = slug => (MARKS[slug] || []).length > 0;

// escape, then splice the marker around each audited span
function markHtml(raw, slug) {
  let html = esc(raw);
  for (const t of (MARKS[slug] || [])) {
    const et = esc(t);
    if (html.includes(et)) {
      html = html.replace(et,
        `<span class="unv">${et} <span class="unv__t">unverified</span></span>`);
    }
  }
  return html;
}
function markMd(raw, slug) {
  let out = String(raw == null ? '' : raw);
  for (const t of (MARKS[slug] || [])) {
    if (out.includes(t)) out = out.replace(t, `${t} **[unverified]**`);
  }
  return out;
}

// recursively copy a directory
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }

// ---- shared CSS (seed palette + new components) ----
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

// ---- phase 15: feedback-form styling ----
// Interpolated into CSS only when SUPABASE_ON. With the switch off not one of
// these rules is emitted, so dist/ carries no trace of the form — not markup,
// not script, not a dead selector. That is what makes the revert provable rather
// than merely intended.
//
// Colours come from the same :root palette as the rest of the site, so when the
// switch IS on, GATE 4 contrast-checks these pairs alongside every other one
// rather than treating the form as a special case. The input border is #8B958F
// on #FFFFFF (3.09:1), which clears the WCAG 1.4.11 non-text threshold; focus is
// the site-wide 2px :focus-visible outline, unmodified.
const FBFORM_CSS = !SUPABASE_ON ? '' : `
/* phase 15: feedback form */
.fbform{border:1px solid var(--rule);background:var(--card);padding:22px;max-width:var(--measure)}
.fbfield{margin:0 0 18px}
.fbfield:last-of-type{margin-bottom:22px}
.fbform label{display:block;font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--cut-ink);margin:0 0 7px}
.fbform .opt{letter-spacing:.04em;text-transform:none;color:var(--soft);font-size:12px}
.fbform textarea,.fbform input[type=email]{width:100%;font-family:var(--body);font-size:16px;line-height:1.55;color:var(--ink);background:#FFFFFF;border:1px solid #8B958F;border-radius:2px;padding:10px 12px}
.fbform textarea{min-height:104px;resize:vertical}
.fbform textarea:focus-visible,.fbform input[type=email]:focus-visible{border-color:var(--cut)}
.fbhint{font-family:var(--body);font-size:13.5px;color:#4A574F;margin:6px 0 0}
.fbsend{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;background:var(--ink);color:#F3F5F0;border:0;border-radius:2px;padding:13px 20px;cursor:pointer;transition:background .15s}
.fbsend:hover,.fbsend:focus-visible{background:var(--cut-ink)}
.fbsend[disabled]{background:#4C5B53;color:#F3F5F0;cursor:default}
.fbstatus{font-family:var(--mono);font-size:13px;color:var(--ink);margin:14px 0 0;min-height:1.4em}
.fbstatus--ok{color:#1F5446}
.fbstatus--err{color:var(--cut-ink)}
.fbfallback{border-left:3px solid var(--cut);padding:12px 0 12px 14px;margin:16px 0 0}
.fbfallback p{font-size:14.5px;color:#2A3A33;margin:0 0 10px}
`;

// The print counterpart, same gating. On paper the form collapses to the same
// email link the switched-off site shows, so what a faculty member prints is
// identical whichever side of the kill switch the build was on.
const FBFORM_PRINT_CSS = !SUPABASE_ON ? '' : `
  .fbform{border:0!important;padding:0!important;background:none!important}
  .fbfield,.fbsend,.fbstatus{display:none!important}
  .fbfallback{display:block!important;border-left:2pt solid #000;padding:0 0 0 8pt;margin:0}
  .fbfallback p:first-child{display:none!important}
`;

const CSS = `
:root{
  --paper:#F3F5F0;--card:#FFFFFF;--mat:#17352C;--mat-deep:#0D211B;--ink:#15211C;
  --soft:#4C5B53;--cut:#DE3F26;--cut-ink:#BF2F19;--cut-lit:#FF6A4D;--rule:#D6DCD4;
  --good:#2F6F5E;--measure:74ch;
  --display:"Bricolage Grotesque",-apple-system,BlinkMacSystemFont,sans-serif;
  --body:"Atkinson Hyperlegible",-apple-system,BlinkMacSystemFont,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
a{color:var(--cut-ink)}
:focus-visible{outline:2px solid var(--cut);outline-offset:3px}

/* hero (hub + discipline) */
.hero{background:var(--mat);color:#EAF0EA;position:relative;overflow:hidden;border-bottom:3px solid var(--mat-deep)}
.hero::before{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:repeating-linear-gradient(to right,rgba(255,255,255,.07) 0 1px,transparent 1px 40px),repeating-linear-gradient(to bottom,rgba(255,255,255,.07) 0 1px,transparent 1px 40px)}
.hero__inner{position:relative;padding:64px 0 52px}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9CC3B0;margin:0 0 22px}
.hero h1{font-family:var(--display);font-weight:800;font-variation-settings:"wdth" 82,"wght" 800;font-size:clamp(2.4rem,6.6vw,4.4rem);line-height:.98;letter-spacing:-.025em;margin:0 0 20px;max-width:18ch}
.hero h1 em{font-style:normal;color:var(--cut-lit)}
.hero__sub{margin:0 0 30px;max-width:58ch;font-size:1.1rem;color:#CFDDD2}
.hero__meta{font-family:var(--mono);font-size:12.5px;letter-spacing:.06em;color:#8FB8A4;border-top:1px solid rgba(255,255,255,.18);padding-top:16px;margin:0 0 30px}
.backlink{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#CFDDD2;text-decoration:none;display:inline-block;margin:0 0 22px}
.backlink:hover,.backlink:focus-visible{color:#fff}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{font-family:var(--mono);font-size:12.5px;letter-spacing:.02em;color:#DCE8DC;text-decoration:none;padding:7px 11px;border:1px solid rgba(255,255,255,.24);border-radius:2px;transition:background .15s,border-color .15s,color .15s}
.chip:hover,.chip:focus-visible{background:#fff;border-color:#fff;color:var(--mat)}

/* brief (hub) */
.brief{padding:52px 0 12px;border-bottom:1px solid var(--rule)}
.brief__grid{display:grid;grid-template-columns:1fr 1fr;gap:44px}
.brief h2{font-family:var(--display);font-weight:700;font-variation-settings:"wdth" 88,"wght" 700;font-size:1.5rem;letter-spacing:-.015em;margin:0 0 14px}
.brief p{margin:0 0 14px;max-width:var(--measure);color:#2A3A33}
.facts{list-style:none;margin:0;padding:0}
.facts li{display:grid;grid-template-columns:118px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--rule);align-items:baseline}
.facts li:last-child{border-bottom:1px solid var(--rule)}
.facts .k{font-family:var(--mono);font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--cut-ink)}
.facts .v{font-size:15.5px;color:#2A3A33;line-height:1.5}

/* sticky jump */
.jump{position:sticky;top:0;z-index:20;background:rgba(243,245,240,.94);backdrop-filter:blur(6px);border-bottom:1px solid var(--rule)}
.jump__inner{display:flex;align-items:center;gap:14px;padding:9px 0}
.jump label{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--soft)}
.jump select{font-family:var(--mono);font-size:12.5px;color:var(--ink);background:#fff;border:1px solid var(--rule);border-radius:2px;padding:6px 9px;max-width:280px}

/* hub cards */
.sheet{padding:48px 0 20px}
.sheet__label{font-family:var(--mono);font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);margin:0 0 26px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{position:relative;display:block;background:var(--card);border:1px dashed var(--cut);padding:26px 26px 22px;text-decoration:none;color:var(--ink);transition:transform .15s,box-shadow .15s}
.card:hover,.card:focus-visible{transform:translateY(-2px);box-shadow:0 6px 22px rgba(21,33,28,.10)}
.card .no{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--cut-ink);margin:0 0 6px}
.card .nm{font-family:var(--display);font-weight:700;font-variation-settings:"wdth" 86,"wght" 700;font-size:1.4rem;line-height:1.06;letter-spacing:-.02em;margin:0 0 8px}
.card .hk{margin:0 0 14px;color:#33453D;font-size:.98rem}
.card .tags{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--soft);display:flex;gap:14px;flex-wrap:wrap}
.card .go{position:absolute;right:22px;bottom:18px;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cut-ink)}
.marks i{position:absolute;width:9px;height:9px;border:1px solid var(--cut);border-radius:50%}
.marks i:nth-child(1){top:-5px;left:-5px}.marks i:nth-child(2){top:-5px;right:-5px}
.marks i:nth-child(3){bottom:-5px;left:-5px}.marks i:nth-child(4){bottom:-5px;right:-5px}

/* discipline sections */
main.disc{padding:8px 0 20px}
.sec{border-top:1px solid var(--rule);padding:34px 0}
.sec:first-child{border-top:0}
.sec__label{font-family:var(--mono);font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--cut-ink);margin:0 0 14px}
.sec h2{font-family:var(--display);font-weight:700;font-variation-settings:"wdth" 88,"wght" 700;font-size:1.55rem;letter-spacing:-.015em;margin:0 0 14px}
.sec p{max-width:var(--measure);color:#2A3A33}
.tt{background:var(--mat);color:#EAF0EA;padding:30px 30px;border:0;position:relative}
.tt .sec__label{color:#9CC3B0}
.tt h2{color:#fff}
.tt p{color:#D7E4DA;max-width:66ch;font-size:1.06rem}
.specs{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:2px solid var(--ink)}
.spec{padding:18px 26px 20px 0}
.spec+.spec{padding:18px 0 20px 26px;border-left:1px solid var(--rule)}
.spec__head{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px;color:var(--ink);display:flex;flex-wrap:wrap;gap:10px;align-items:baseline}
.spec__tool{letter-spacing:.04em;text-transform:none;color:var(--soft);font-size:11.5px}
.spec p{margin:0;font-size:15.6px;line-height:1.62;color:#2A3A33}
.demoframe{width:100%;height:640px;border:1px dashed var(--cut);background:var(--card)}
.demonote{font-family:var(--mono);font-size:11.5px;color:var(--soft);margin:10px 0 0}
.livebuild{border:2px dashed var(--cut);background:repeating-linear-gradient(45deg,#fff,#fff 12px,#FBF3F1 12px,#FBF3F1 24px);padding:26px}
.livebuild .tag{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--cut-ink)}
.livebuild p{color:#57675E}
.plan__list{list-style:none;margin:0;padding:0}
.plan__list li{display:grid;grid-template-columns:64px 1fr;gap:16px;padding:9px 0;align-items:baseline}
.plan__wk{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cut-ink)}
.plan__txt{font-size:15.6px;line-height:1.6;color:#2A3A33}
.prompt{border:1px solid var(--rule);background:#FAFBF8}
.prompt__bar{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:11px 14px;border-bottom:1px solid var(--rule)}
.prompt__label{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;margin:0;color:var(--soft)}
.copy{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;background:var(--ink);color:#F3F5F0;border:0;border-radius:2px;padding:7px 13px;cursor:pointer;transition:background .15s}
.copy:hover,.copy:focus-visible{background:var(--cut-ink)}
.prompt__text{font-family:var(--mono);font-size:13.4px;line-height:1.68;margin:0;padding:16px 14px;white-space:pre-wrap;word-break:break-word;color:#22322C}
.po{margin-top:22px;border:1px solid var(--rule);background:var(--card)}
.po__meta{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--soft);padding:11px 14px;border-bottom:1px solid var(--rule)}
.po__out{font-family:var(--mono);font-size:12.8px;line-height:1.62;margin:0;padding:16px 14px;white-space:pre-wrap;word-break:break-word;color:#22322C;max-height:520px;overflow:auto;border-bottom:1px solid var(--rule)}
.po__ann{margin:0;padding:14px 14px 6px;list-style:none}
.po__ann li{padding:9px 0;border-top:1px solid var(--rule)}
.po__ann li:first-child{border-top:0}
.po__ann .m{font-family:var(--mono);font-size:12.5px;color:var(--cut-ink);display:block;margin-bottom:3px}
.po__ann .n{font-size:14.5px;color:#2A3A33}
table.rub{width:100%;border-collapse:collapse;font-size:15px}
table.rub th,table.rub td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
table.rub th{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--cut-ink)}
table.rub td.w{font-family:var(--mono);white-space:nowrap;color:var(--ink)}
.kv{list-style:none;margin:0;padding:0}
.kv li{display:grid;grid-template-columns:180px 1fr;gap:16px;padding:11px 0;border-top:1px solid var(--rule)}
.kv li:first-child{border-top:0}
.kv .k{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cut-ink)}
.kv .v{font-size:15.5px;color:#2A3A33}
.scales{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.scale{border:1px solid var(--rule);background:var(--card);padding:16px}
.scale h3{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--cut-ink);margin:0 0 8px}
.scale p{margin:0;font-size:14.5px;color:#2A3A33}
.related{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rel{display:block;border:1px solid var(--rule);background:var(--card);padding:16px;text-decoration:none;color:var(--ink)}
.rel:hover,.rel:focus-visible{border-color:var(--cut)}
.rel .nm{font-family:var(--display);font-weight:700;font-size:1.1rem;margin:0 0 6px}
.rel .why{font-size:14px;color:#2A3A33;margin:0}
.replaces .rg{display:grid;grid-template-columns:1fr;gap:10px;margin-top:6px}
.replaces .rg div{border-left:3px solid var(--rule);padding-left:12px}
.replaces .rg .lbl{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cut-ink)}

/* phase 11: feedback link */
.fb{display:inline-block;font-family:var(--mono);font-size:13px;letter-spacing:.04em;
  background:var(--ink);color:#F3F5F0;text-decoration:none;padding:12px 18px;border-radius:2px}
.fb:hover,.fb:focus-visible{background:var(--cut-ink);color:#FFFFFF}

${FBFORM_CSS}
/* phase 7: unverified-claim marker */
.unv{background:#FBEED9;color:#15211C;box-shadow:inset 0 -2px 0 #7A3E0B;padding:1px 3px}
.unv__t{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;background:#7A3E0B;color:#FFFFFF;padding:2px 6px;margin-left:4px;white-space:nowrap}
.unvnote{background:#FBEED9;color:#15211C;border-left:4px solid #7A3E0B;padding:14px 16px;margin:0 0 20px;font-size:14.5px;max-width:var(--measure)}
.unvnote .hd{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5A2E08;display:block;margin-bottom:5px}

/* claim audit page */
.auditlist{display:grid;gap:14px;padding:10px 0 20px}
.claimrow{border:1px solid var(--rule);background:var(--card);padding:16px 18px;border-left:4px solid var(--rule)}
.claimrow--refuted{border-left-color:var(--cut-ink)}
.claimrow--unverifiable{border-left-color:#7A3E0B}
.claimrow--verified{border-left-color:var(--good)}
.claimrow__hd{display:flex;align-items:center;gap:12px;margin:0 0 8px}
.cid{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--soft)}
.stbadge{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;border-radius:2px}
.stbadge--refuted{background:var(--cut-ink);color:#FFFFFF}
.stbadge--unverifiable{background:#7A3E0B;color:#FFFFFF}
.stbadge--verified{background:var(--good);color:#FFFFFF}
.claimrow__q{margin:0 0 8px;color:var(--ink);font-size:15.5px}
.claimrow__meta{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--soft);margin:0 0 8px;word-break:break-word}
.claimrow__note{margin:0 0 8px;color:#2A3A33;font-size:14.5px;max-width:var(--measure)}
.claimrow__src{margin:0;font-size:13.5px;color:#2A3A33;word-break:break-word}
.muted{color:var(--soft)}

footer{padding:30px 0 46px;font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;color:var(--soft);border-top:1px solid var(--rule);margin-top:20px}

@media (max-width:760px){
  body{font-size:16px}
  .wrap{padding:0 20px}
  .hero__inner{padding:46px 0 38px}
  .brief__grid,.cards,.related{grid-template-columns:1fr}
  .specs{grid-template-columns:1fr}
  .spec{padding:16px 0 4px}
  .spec+.spec{padding:16px 0 4px;border-left:0;border-top:1px solid var(--rule)}
  .scales{grid-template-columns:1fr}
  .kv li,.facts li{grid-template-columns:1fr;gap:4px}
  .plan__list li{grid-template-columns:52px 1fr;gap:12px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}

/* screen: the print-only demo substitution line is hidden */
.printonly{display:none}

/* ---- phase 9: print stylesheet ----
   Black on white, no navigation, no iframes. The demo section is replaced by a
   line naming the demo and where to run it, and every major section starts on a
   fresh page. One section per page is what "page breaks between major sections"
   asks for literally; it runs a discipline page to roughly ten to twelve sheets,
   which is why the handout exists as the compact artifact. If a reader would
   rather have a dense printout, change .sec{break-before:page} to
   .sec{break-inside:avoid} on the line below and nothing else needs to move. */
@media print{
  @page{margin:16mm 14mm}
  html,body{background:#fff!important;color:#000!important;font-size:10.5pt;line-height:1.45}
  .wrap{max-width:none;padding:0}

  /* navigation and interactive chrome do not survive to paper */
  .jump,.chips,.backlink,.copy,.marks,.demoframe,.related,nav{display:none!important}

  /* every surface goes black on white */
  .hero,.tt,.livebuild,.prompt,.po,.card,.scale,.claimrow,.unvnote{
    background:#fff!important;color:#000!important;box-shadow:none!important}
  .hero::before{display:none!important}
  .hero,.tt{border:0!important;border-bottom:1.5pt solid #000!important}
  .hero__inner{padding:0 0 10pt}
  *{color:#000!important}
  a{color:#000!important;text-decoration:none}
  .livebuild{border:1pt dashed #000!important;background-image:none!important}
  .prompt,.po,.scale,.claimrow{border:0.5pt solid #000!important}
  .unv{background:#fff!important;box-shadow:none!important;border-bottom:1.5pt solid #000!important}
  .unv__t{background:#fff!important;border:0.5pt solid #000!important}
  .unvnote{border-left:2pt solid #000!important}

  /* the demo iframe is replaced by a line naming it and where to run it */
  .printonly{display:block!important;border:0.5pt dashed #000;padding:8pt 10pt;
    font-family:var(--mono);font-size:9.5pt;line-height:1.5}

  /* page breaks between major sections */
  .sec{break-before:page;break-inside:auto;border-top:0.5pt solid #000;padding:12pt 0 0}
  .sec:first-of-type{break-before:auto}
  .sec h2,.sec__label{break-after:avoid}
  table.rub,.kv li,.facts li,.plan__list li,.po__ann li,.spec{break-inside:avoid}
  .hero h1{font-size:22pt;max-width:none}
  .sec h2{font-size:14pt}
  .po__out{max-height:none!important;overflow:visible!important;font-size:8.5pt}
  .prompt__text{font-size:9pt}
${FBFORM_PRINT_CSS}
  footer{border-top:0.5pt solid #000;break-before:avoid}
}
`;

const COPY_JS = `
document.querySelectorAll('.copy').forEach(function(btn){
  btn.addEventListener('click',function(){
    var el=document.getElementById(btn.dataset.target);
    var txt=el?el.textContent:'';
    var done=function(){btn.textContent='Copied';setTimeout(function(){btn.textContent='Copy prompt';},1600);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,function(){fb(txt,done);});}
    else{fb(txt,done);}
  });
});
function fb(txt,cb){var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');cb();}catch(e){}document.body.removeChild(ta);}
`;

const JUMP_JS = `
var sel=document.getElementById('jumpsel');
if(sel)sel.addEventListener('change',function(){if(sel.value)window.location.href=sel.value;});
`;

function page(title, desc, bodyHtml, extraJs) {
  return `<!DOCTYPE html>
${STAMP}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(desc)}">
${FONTS}
<style>${CSS}</style>
</head>
<body>
${bodyHtml}
<script>${JUMP_JS}${extraJs || ''}</script>
</body>
</html>
`;
}

// The one place an alias is allowed to surface: plain text in the hub footer,
// with the scheme stripped so it reads as an address rather than a link. Not an
// <a href>, deliberately — the canonical address stays SITE_URL.
function aliasNote() {
  if (!ALIASES.length) return '';
  const hosts = ALIASES.map(a => a.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  return ` &middot; also at ${esc(hosts.join(', '))}`;
}

function jumpMenu(all, base) {
  const opts = all.map(d => `<option value="${base}${d.slug}/index.html">${esc(d.name)}</option>`).join('');
  return `<div class="jump"><div class="wrap jump__inner">
  <label for="jumpsel">Jump to</label>
  <select id="jumpsel"><option value="">Choose a discipline&hellip;</option>${opts}</select>
</div></div>`;
}

// ---- hub ----
function renderHub(all) {
  const chips = all.map(d => `<a class="chip" href="${d.slug}/index.html">${esc(d.name)}</a>`).join('\n');
  const cards = all.map(d => `
    <a class="card" id="${d.slug}" href="${d.slug}/index.html">
      <div class="marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p class="no">Part ${String(d.part).padStart(2,'0')} / 15</p>
      <h3 class="nm">${esc(d.name)}</h3>
      <p class="hk">${esc(d.hook)}</p>
      <p class="tags"><span>Make · ${esc(d.make.tool)}</span><span>Build · ${esc(d.build.tool)}</span></p>
      <span class="go">Open assignment &rarr;</span>
    </a>`).join('\n');

  const body = `
<header class="hero"><div class="wrap hero__inner">
  <p class="eyebrow">EL3vate 2026 &middot; Day 8 &middot; 29 July</p>
  <h1>Prototyping <em>solutions</em></h1>
  <p class="hero__sub">Fifteen disciplines, fifteen assignments. Each one has something students make with their hands, something they build with AI, and a plan that fits inside a real semester &mdash; now with a 90-minute version, a rubric, a budget, and a real annotated model output for each.</p>
  <p class="hero__meta">Tim Lum &middot; AI Innovation Team Director &middot; PACE, Shidler College of Business &middot; University of Hawai&#699;i at M&#257;noa</p>
  <nav aria-label="Jump to a discipline"><div class="chips">${chips}</div></nav>
</div></header>

<section class="brief"><div class="wrap brief__grid">
  <div>
    <h2>How to use this site</h2>
    <p>Find your field. Start with <strong>Try it Tuesday</strong> &mdash; a 90-minute version you can run this week with no prep beyond reading the page. When you have more room, the multi-week plan &mdash; four weeks for most disciplines, five where the physical build depends on an earlier week&rsquo;s output &mdash; and the one-semester version are there too.</p>
    <p>Nothing here needs you to learn a tool first. The physical builds go through PACE as a service: students submit a file, we fabricate it. The AI builds happen in a chat window, and every page shows a real model output with its failures marked.</p>
  </div>
  <div>
    <h2>What PACE provides</h2>
    <ul class="facts">
      <li><span class="k">3D printing</span><span class="v">Free for UH faculty. Students submit an .stl file; we print and return it.</span></li>
      <li><span class="k">Laser cutting</span><span class="v">Cut and engrave in acrylic, wood and paper stock. Same file-submission model.</span></li>
      <li><span class="k">Hana studio</span><span class="v">Recording space for podcasts, oral assessments and recorded role-play.</span></li>
      <li><span class="k">Turnaround</span><span class="v">Plan on 7&ndash;10 <strong>business</strong> days &mdash; about two calendar weeks &mdash; from file to finished part. Build that into your dates.</span></li>
      <li><span class="k">Submitting a file</span><span class="v">Fabrication files are submitted through the PACE request form, from a UH email address. Ask Tim Lum at PACE for the form link and pass it to your students.</span></li>
      <li><span class="k">In-person access</span><span class="v">Visiting the space in person is currently <strong>by appointment</strong>. That is separate from submitting a file &mdash; nobody has to come in to have something made.</span></li>
      <li><span class="k">Contact</span><span class="v">Tim Lum, PACE &middot; pace.shidler.hawaii.edu/maker</span></li>
    </ul>
  </div>
</div></section>

${jumpMenu(all, '')}

<main class="sheet"><div class="wrap">
  <p class="sheet__label">Cut sheet &middot; 15 parts &middot; one per discipline</p>
  <div class="cards">${cards}</div>
</div></main>

<footer><div class="wrap">EL3vate 2026 &middot; Day 8 session resource &middot; Prepared for the faculty cohort &middot; Build ${SHA}${aliasNote()}</div></footer>
`;
  return page('Prototyping Solutions · EL3vate 2026 Day 8',
    'Physical and AI prototyping assignments, one per discipline, for the EL3vate 2026 faculty cohort at the University of Hawaiʻi.',
    body);
}

// ---- discipline page ----
function sectionTry(d) {
  return `<section class="sec tt" id="try-tuesday">
    <p class="sec__label">Try it Tuesday &middot; 90 minutes</p>
    <h2>Run this next week</h2>
    <p>${esc(d.tryTuesday)}</p>
  </section>`;
}
function sectionMakeBuild(d) {
  return `<section class="sec" id="make-build">
    <p class="sec__label">The full assignment</p>
    <div class="specs">
      <div class="spec"><p class="spec__head">Make it <span class="spec__tool">${esc(d.make.tool)}</span></p><p>${esc(d.make.body)}</p></div>
      <div class="spec"><p class="spec__head">Build it <span class="spec__tool">${esc(d.build.tool)}</span></p><p>${esc(d.build.body)}</p></div>
    </div>
  </section>`;
}
function sectionDemo(d) {
  if (!d.demo) return '';
  return `<section class="sec" id="demo">
    <p class="sec__label">Try the demo &middot; runs offline</p>
    <h2>${esc(d.name)} demo</h2>
    <iframe class="demoframe" src="../demos/${esc(d.demo)}/index.html" title="${escAttr(d.name)} interactive demo" loading="lazy"></iframe>
    <p class="printonly">Interactive demo &mdash; &ldquo;${esc(d.demo)}&rdquo;. It cannot be printed; run it in a browser at
      ${esc(SITE_URL)}/demos/${esc(d.demo)}/index.html</p>
    <p class="demonote">This demo runs entirely offline against canned data &mdash; no keys, no network, safe on conference wifi.</p>
  </section>`;
}
// How many weeks a plan actually runs is data, not a constant: two disciplines
// need five because their artifact cannot be designed until a week-2 output
// exists. Every "N weeks" label is derived from plan.length so a plan that grows
// or shrinks can never leave a stale heading above the list.
const planWeeks = d => d.plan.length;

function sectionPlan(d) {
  const items = d.plan.map(p => `<li><span class="plan__wk">${esc(p.wk)}</span><span class="plan__txt">${esc(p.txt)}</span></li>`).join('');
  return `<section class="sec" id="plan">
    <p class="sec__label">${planWeeks(d)} weeks, realistically</p>
    <h2>The ${planWeeks(d)}-week version</h2>
    <ol class="plan__list">${items}</ol>
  </section>`;
}
function sectionPrompt(d, idx) {
  const po = d.promptOutput;
  let poHtml = '';
  if (po) {
    const ann = po.annotations.map(a =>
      `<li><span class="m">${esc(a.marker)}</span><span class="n">${esc(a.note)}</span></li>`).join('');
    poHtml = `<div class="po">
      <p class="po__meta">Real, unedited model output &middot; ${esc(po.model)}<br>Prompt filled in as: ${esc(po.promptFilled)}</p>
      <pre class="po__out">${esc(po.output)}</pre>
      <ul class="po__ann">${ann}</ul>
    </div>`;
  } else {
    poHtml = `<p class="demonote">No genuine model output was captured for this discipline; see BLOCKERS.md. No fabricated output is shown here.</p>`;
  }
  const pid = 'p' + idx;
  return `<section class="sec" id="prompt">
    <p class="sec__label">Starter prompt &amp; what the model actually did</p>
    <h2>The prompt, run for real</h2>
    <div class="prompt">
      <div class="prompt__bar"><p class="prompt__label">Starter prompt</p><button class="copy" type="button" data-target="${pid}">Copy prompt</button></div>
      <pre class="prompt__text" id="${pid}">${esc(d.prompt)}</pre>
    </div>
    ${poHtml}
  </section>`;
}
function sectionRubric(d) {
  const rows = d.rubric.map(r =>
    `<tr><td>${esc(r.criterion)}</td><td class="w">${esc(r.weight)}%</td><td>${esc(r.description)}</td></tr>`).join('');
  return `<section class="sec" id="rubric">
    <p class="sec__label">Assessment</p>
    <h2>Rubric</h2>
    <table class="rub"><thead><tr><th>Criterion</th><th>Weight</th><th>What it assesses</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}
function sectionReplaces(d) {
  const r = d.replaces;
  return `<section class="sec replaces" id="replaces">
    <p class="sec__label">What this replaces</p>
    <h2>Swapping it into a real course</h2>
    <div class="rg">
      <div><p class="lbl">Replaces</p><p>${esc(r.assignment)}</p></div>
      <div><p class="lbl">What is lost</p><p>${esc(r.lost)}</p></div>
      <div><p class="lbl">What is gained</p><p>${esc(r.gained)}</p></div>
    </div>
  </section>`;
}
function sectionAiFails(d) {
  return `<section class="sec" id="ai-fails">
    <p class="sec__label">Where AI is bad at this</p>
    <h2>The failure your students should catch</h2>
    <p>${esc(d.aiFailsHere)}</p>
  </section>`;
}
function sectionBudget(d) {
  const b = d.budget;
  return `<section class="sec" id="budget">
    <p class="sec__label">Budget &amp; logistics</p>
    <h2>What it costs to run</h2>
    <ul class="kv">
      <li><span class="k">Instructor prep</span><span class="v">${esc(b.prepHours)} hours</span></li>
      <li><span class="k">Class time</span><span class="v">${esc(b.classMinutes)} minutes</span></li>
      <li><span class="k">Per-student cost</span><span class="v">${markHtml(b.perStudentCost, d.slug)}</span></li>
      <li><span class="k">Fabrication file due</span><span class="v">${esc(b.fileDueWeek)}</span></li>
      <li><span class="k">Calendar dependency</span><span class="v">${esc(b.calendarNote)}</span></li>
    </ul>
  </section>`;
}
function sectionScales(d) {
  const s = d.scales;
  return `<section class="sec" id="scales">
    <p class="sec__label">Three sizes</p>
    <h2>Scale it to the time you have</h2>
    <div class="scales">
      <div class="scale"><h3>One session</h3><p>${esc(s.oneSession)}</p></div>
      <div class="scale"><h3>${planWeeks(d)} weeks</h3><p>${esc(s.fourWeeks)}</p></div>
      <div class="scale"><h3>One semester</h3><p>${esc(s.oneSemester)}</p></div>
    </div>
  </section>`;
}
function sectionRelated(d, bySlug) {
  const cards = d.related.map(r => {
    const o = bySlug[r.slug];
    const nm = o ? o.name : r.slug;
    return `<a class="rel" href="../${esc(r.slug)}/index.html"><p class="nm">${esc(nm)}</p><p class="why">${esc(r.reason)}</p></a>`;
  }).join('');
  return `<section class="sec" id="related">
    <p class="sec__label">Related disciplines</p>
    <h2>Same problem, other fields</h2>
    <div class="related">${cards}</div>
  </section>`;
}
function sectionLiveBuild(d) {
  const filled = d.liveBuild && String(d.liveBuild).trim();
  const inner = filled
    ? `<p class="tag">Built live in session</p><p style="color:#2A3A33">${esc(d.liveBuild)}</p>`
    : `<p class="tag">Reserved &middot; live build</p><p>This space is intentionally empty. During the Day 8 session it gets filled in live with whatever this room asks for.</p>`;
  return `<section class="sec" id="live-build">
    <div class="livebuild">${inner}</div>
  </section>`;
}

function renderDiscipline(d, all, bySlug) {
  const idx = d.part - 1;
  const body = `
<header class="hero"><div class="wrap hero__inner">
  <a class="backlink" href="../index.html">&larr; All 15 disciplines</a>
  <p class="eyebrow">EL3vate 2026 &middot; Day 8 &middot; Part ${String(d.part).padStart(2,'0')} / 15</p>
  <h1>${esc(d.name)}</h1>
  <p class="hero__sub">${esc(d.hook)}</p>
</div></header>

${jumpMenu(all, '../')}

<main class="disc"><div class="wrap">
  ${hasMarks(d.slug) ? `<p class="unvnote"><span class="hd">About the unverified marks on this page</span>Figures tagged <span class="unv__t">unverified</span> are PACE-local estimates that could not be confirmed against any published source, so they are labelled rather than quietly presented as fact. Every other factual claim on this page &mdash; statutes, standards codes, gene biology, primary-source citations &mdash; was independently checked; the <a href="../audit.html">full claim audit</a>, including what came back wrong, lists every claim with its source.</p>` : ''}
  ${sectionTry(d)}
  ${sectionMakeBuild(d)}
  ${sectionDemo(d)}
  ${sectionPlan(d)}
  ${sectionPrompt(d, idx)}
  ${sectionRubric(d)}
  ${sectionReplaces(d)}
  ${sectionAiFails(d)}
  ${sectionBudget(d)}
  ${sectionScales(d)}
  ${sectionRelated(d, bySlug)}
  ${sectionLiveBuild(d)}
  ${sectionFeedback(d)}
  <p style="margin-top:26px"><a href="handout.md">Download the &ldquo;steal this&rdquo; handout (Markdown) &rarr;</a></p>
</div></main>

<footer><div class="wrap">EL3vate 2026 &middot; Day 8 &middot; ${esc(d.name)} &middot; Build ${SHA}</div></footer>
`;
  return page(`${d.name} · EL3vate 2026 Day 8`,
    `Prototyping assignment for ${d.name}: a 90-minute version, ${planWeeks(d)}-week plan, rubric, budget, and a real annotated AI output.`,
    body, COPY_JS + feedbackJs());
}

// ---- handout ----
function renderHandout(d) {
  const rub = d.rubric.map(r => `| ${r.criterion} | ${r.weight}% | ${r.description.replace(/\|/g,'\\|')} |`).join('\n');
  const b = d.budget;
  const plan = d.plan.map(p => `- **${p.wk}.** ${p.txt}`).join('\n');
  return `# ${d.name} — steal this assignment
_EL3vate 2026 · Day 8 · Part ${String(d.part).padStart(2,'0')} of 15 · build ${SHA}_

## Try it Tuesday (90 minutes)
${d.tryTuesday}

## The assignment
**Make it (${d.make.tool}).** ${d.make.body}

**Build it (${d.build.tool}).** ${d.build.body}

## ${planWeeks(d)}-week plan
${plan}

## What this replaces
- **Replaces:** ${d.replaces.assignment}
- **What is lost:** ${d.replaces.lost}
- **What is gained:** ${d.replaces.gained}

## Where AI is bad at this
${d.aiFailsHere}

## Rubric
| Criterion | Weight | What it assesses |
|---|---|---|
${rub}

## Starter prompt
> ${d.prompt.replace(/\n/g, '\n> ')}

## Budget & logistics
- **Instructor prep:** ${b.prepHours} hours
- **Class time:** ${b.classMinutes} minutes
- **Per-student cost:** ${markMd(b.perStudentCost, d.slug)}
- **Fabrication file due:** ${b.fileDueWeek}
- **Calendar dependency:** ${b.calendarNote}

## Three sizes
- **One session:** ${d.scales.oneSession}
- **${planWeeks(d)} weeks:** ${d.scales.fourWeeks}
- **One semester:** ${d.scales.oneSemester}

---
_PACE · Shidler College of Business · University of Hawaiʻi at Mānoa · pace.shidler.hawaii.edu/maker_
_All fifteen assignments, the demos and every handout: ${SITE_URL}_
`;
}

// ---- phase 9: markdown -> print-styled HTML ----
// A purpose-built renderer for exactly the constructs renderHandout() emits:
// headings, an italic meta line, paragraphs, bold runs, bullet lists, pipe
// tables with escaped pipes, blockquotes and a rule. Deliberately not a general
// markdown parser — the input is generated by the line above, so the subset is
// closed and a dependency would buy nothing.
function mdInline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function mdCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/)                       // renderHandout escapes literal pipes
    .map(c => c.trim().replace(/\\\|/g, '|'));
}
const isSepRow = cells => cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c));

function mdToHtml(md) {
  const lines = String(md).split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push('<p>' + mdInline(para.join(' ')) + '</p>'); para = []; } };
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { flush(); i++; continue; }

    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      flush(); out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); i++; continue;
    }
    if (/^-{3,}$/.test(t)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^_[^_].*[^_]_$/.test(t)) { flush(); out.push(`<p class="meta">${mdInline(t.slice(1, -1))}</p>`); i++; continue; }

    if (t.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(mdCells(lines[i])); i++; }
      const head = rows.length && !isSepRow(rows[0]) ? rows[0] : null;
      const body = rows.filter((r, idx) => !(idx === 0 && head) && !isSepRow(r));
      out.push('<table>' +
        (head ? '<thead><tr>' + head.map(c => `<th>${mdInline(c)}</th>`).join('') + '</tr></thead>' : '') +
        '<tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${mdInline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }
    if (/^[-*]\s/.test(t)) {
      flush();
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++;
      }
      out.push('<ul>' + items.map(x => `<li>${mdInline(x)}</li>`).join('') + '</ul>');
      continue;
    }
    if (t.startsWith('>')) {
      flush();
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + q.map(mdInline).join('<br>') + '</blockquote>');
      continue;
    }
    para.push(t); i++;
  }
  flush();
  return out.join('\n');
}

// Handouts are print artifacts first: system font stack only, so they render
// identically with the network down and the PDF step never waits on a CDN.
const HANDOUT_CSS = `
*{box-sizing:border-box}
html,body{background:#fff;color:#111;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  font-size:10.5pt;line-height:1.5}
.sheet{max-width:186mm;margin:0 auto;padding:16mm}
.hsheet{break-after:page}
.hsheet:last-child{break-after:auto}
h1{font-size:19pt;line-height:1.15;margin:0 0 4pt;letter-spacing:-.012em}
h2{font-size:12.5pt;margin:15pt 0 6pt;padding-bottom:3pt;border-bottom:.5pt solid #111;break-after:avoid}
p{margin:0 0 7pt}
p.meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5pt;color:#444;margin:0 0 12pt}
ul{margin:0 0 8pt;padding-left:16pt}
li{margin:0 0 4pt}
blockquote{margin:0 0 8pt;padding:8pt 10pt;border-left:2pt solid #111;background:#F4F5F2;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9pt;line-height:1.55}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:0 0 8pt}
th,td{text-align:left;padding:5pt 7pt;border-bottom:.5pt solid #999;vertical-align:top}
th{font-size:8.5pt;letter-spacing:.06em;text-transform:uppercase;border-bottom:1pt solid #111}
td:nth-child(2){white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
hr{border:0;border-top:.5pt solid #999;margin:13pt 0 8pt}
h2,table,blockquote,ul{break-inside:avoid}
.toc{columns:2;column-gap:14mm;font-size:10pt}
@page{margin:16mm}
@media print{.sheet{padding:0;max-width:none}}
`;

function handoutDoc(title, inner) {
  return `<!DOCTYPE html>
${STAMP}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${HANDOUT_CSS}</style>
</head>
<body><div class="sheet">
${inner}
</div></body>
</html>
`;
}

// ============================================================
// phase 11 — session-day artifacts
// ============================================================

// Feedback capture: a mailto with the discipline in the subject, so replies
// sort themselves, and a body that asks the two questions worth asking. No
// backend, no form service, nothing to keep running after Wednesday.
function feedbackHref(d) {
  const subject = `EL3vate Day 8 — ${d.name}`;
  const body = [
    `Discipline: ${d.name}`,
    `Page: ${SITE_URL}/${d.slug}/index.html`,
    '',
    'What I tried:',
    '',
    '',
    'What happened — especially anything the model got wrong:',
    '',
    '',
    'What I would need before I could run this with students:',
    '',
  ].join('\n');
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// phase 15 — the same section in two shapes, chosen by SUPABASE_ON.
//
// OFF (the committed state): exactly what phase 11 shipped — one mailto: link,
// no form, no script, no credential, nothing that touches the network.
//
// ON: a real form that POSTs to the Supabase REST endpoint, with the mailto:
// link still in the markup as a fallback, hidden until a submit actually fails.
// A broken backend therefore degrades to the phase-11 behaviour rather than
// swallowing the submission — and because the mailto: anchor is present in both
// shapes, GATE 10's per-discipline feedback-link check holds either way.
//
// No SDK and no dependency: one fetch, written out inline. The form lives in the
// page shell and never inside a demo iframe, so GATE 5 (demos are offline) is
// untouched by anything here.
function sectionFeedback(d) {
  const intro = `<p class="sec__label">Tell us what happened</p>
    <h2>Run it, then say how it went</h2>
    <p>If you try this &mdash; the 90-minute version, the prompt, any part of it &mdash; send back what you tried and
    what happened, especially anywhere the model was confidently wrong. That is the material the next session is
    built from.</p>`;

  if (!SUPABASE_ON) {
    return `<section class="sec" id="feedback">
    ${intro}
    <p><a class="fb" href="${escAttr(feedbackHref(d))}">Email feedback on ${esc(d.name)} &rarr;</a></p>
    <p class="demonote">Opens a draft in your mail client, already addressed and titled. No form, no account, nothing to sign up for.</p>
  </section>`;
  }

  // Every id is namespaced `fb-` and there is one form per page, so nothing here
  // can collide with the prompt-copy ids (`p0`..`p14`) or the jump menu.
  return `<section class="sec" id="feedback">
    ${intro}
    <form class="fbform" id="fb-form" data-discipline="${escAttr(d.slug)}" data-name="${escAttr(d.name)}" novalidate>
      <div class="fbfield">
        <label for="fb-tried">What you tried <span class="opt">(required)</span></label>
        <textarea id="fb-tried" name="what_they_tried" required maxlength="4000"
          aria-describedby="fb-tried-hint"></textarea>
        <p class="fbhint" id="fb-tried-hint">The prompt, the 90-minute version, one exercise &mdash; whatever you actually ran.</p>
      </div>
      <div class="fbfield">
        <label for="fb-happened">What happened <span class="opt">(optional)</span></label>
        <textarea id="fb-happened" name="what_happened" maxlength="4000"
          aria-describedby="fb-happened-hint"></textarea>
        <p class="fbhint" id="fb-happened-hint">Especially anywhere the model was confidently wrong.</p>
      </div>
      <div class="fbfield">
        <label for="fb-email">Your email <span class="opt">(optional &mdash; only if you want a reply)</span></label>
        <input type="email" id="fb-email" name="contact_email" maxlength="254"
          autocomplete="email" aria-describedby="fb-email-hint">
        <p class="fbhint" id="fb-email-hint">Leave it blank and the submission stays anonymous. Nothing here is required.</p>
      </div>
      <button class="fbsend" type="submit" id="fb-send">Send feedback on ${esc(d.name)}</button>
      <p class="fbstatus" id="fb-status" role="status" aria-live="polite"></p>
      <div class="fbfallback" id="fb-fallback" hidden>
        <p>That did not go through. Nothing was lost &mdash; this link opens the same thing as an email, with
        what you typed already in it.</p>
        <p><a class="fb" id="fb-mailto" href="${escAttr(feedbackHref(d))}">Email feedback on ${esc(d.name)} &rarr;</a></p>
      </div>
    </form>
  </section>`;
}

// The submit handler. Emitted only when SUPABASE_ON, so with the switch off this
// string is never built and neither the endpoint nor the key reaches dist/.
//
// Deliberately not autofocused and deliberately not scrolled to: this sits at the
// bottom of a long page, and moving focus on load breaks screen-reader flow.
function feedbackJs() {
  if (!SUPABASE_ON) return '';
  const endpoint = `${String(SUPABASE_URL).trim().replace(/\/+$/, '')}/rest/v1/el3vate_feedback`;
  return `
(function(){
  var f=document.getElementById('fb-form');
  if(!f)return;
  var send=document.getElementById('fb-send'),status=document.getElementById('fb-status'),
      fall=document.getElementById('fb-fallback'),mail=document.getElementById('fb-mailto'),
      tried=document.getElementById('fb-tried'),happened=document.getElementById('fb-happened'),
      email=document.getElementById('fb-email');
  var baseMailto=mail?mail.getAttribute('href'):'';
  function say(msg,kind){status.textContent=msg;status.className='fbstatus'+(kind?' fbstatus--'+kind:'');}
  // Rebuild the fallback mailto so what they typed rides along in the body
  // rather than being lost with the failed request.
  function degrade(why){
    if(mail&&baseMailto){
      var extra='\\n\\nWhat I tried:\\n'+tried.value+'\\n\\nWhat happened:\\n'+(happened.value||'')+'\\n';
      mail.setAttribute('href',baseMailto+encodeURIComponent(extra));
    }
    if(fall)fall.hidden=false;
    say(why+' Use the email link below \\u2014 what you typed is already in it.','err');
    send.disabled=false;send.textContent=send.dataset.label;
  }
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(!tried.value.trim()){say('Tell us what you tried first \\u2014 that field is the one required one.','err');tried.focus();return;}
    send.dataset.label=send.dataset.label||send.textContent;
    send.disabled=true;send.textContent='Sending\\u2026';
    say('Sending\\u2026');
    var body={discipline:f.dataset.discipline,what_they_tried:tried.value.trim(),
      what_happened:happened.value.trim()||null,contact_email:email.value.trim()||null,
      user_agent:(navigator.userAgent||'').slice(0,512)};
    var done=false;
    var t=setTimeout(function(){if(!done){done=true;degrade('That timed out.');}},12000);
    fetch(${JSON.stringify(endpoint)},{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':${JSON.stringify(String(SUPABASE_ANON_KEY).trim())},
        'Authorization':'Bearer '+${JSON.stringify(String(SUPABASE_ANON_KEY).trim())},'Prefer':'return=minimal'},
      body:JSON.stringify(body)
    }).then(function(r){
      if(done)return;done=true;clearTimeout(t);
      if(r.ok){
        f.querySelectorAll('.fbfield').forEach(function(el){el.hidden=true;});
        send.hidden=true;if(fall)fall.hidden=true;
        say('Thank you \\u2014 that is in. It goes straight into the material for the next session.','ok');
      }else{degrade('That came back as an error ('+r.status+').');}
    }).catch(function(){
      if(done)return;done=true;clearTimeout(t);
      degrade('That could not reach the server \\u2014 the wifi, most likely.');
    });
  });
})();
`;
}

// The closing card: one full-screen slide to share at 1:00. Self-contained and
// offline for the same reason the presenter page is — it is shown from the
// front of a room on conference wifi.
function renderClosingCard(qrSvg) {
  return `<!DOCTYPE html>
${STAMP}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EL3vate 2026 · Day 8 · Closing card</title>
<style>
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:#0D211B;color:#EAF0EA;display:flex;align-items:center;justify-content:center;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:4vmin}
.card{width:100%;max-width:1500px;display:grid;grid-template-columns:1fr auto;gap:6vmin;align-items:center}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(11px,1.5vmin,17px);
  letter-spacing:.24em;text-transform:uppercase;color:#7FB79B;margin:0 0 3vmin}
h1{font-size:clamp(2rem,6.4vmin,5.2rem);line-height:1.02;letter-spacing:-.025em;margin:0 0 3vmin;max-width:20ch}
h1 em{font-style:normal;color:#FF6A4D}
.chal{font-size:clamp(1rem,2.5vmin,2rem);line-height:1.35;color:#D7E4DA;margin:0 0 4vmin;max-width:44ch;
  border-left:.6vmin solid #DE3F26;padding-left:2.4vmin}
.url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(1.1rem,3.4vmin,2.9rem);
  color:#fff;word-break:break-all;margin:0}
.urll{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(10px,1.4vmin,15px);
  letter-spacing:.2em;text-transform:uppercase;color:#7FB79B;margin:0 0 1vmin}
.qr{width:min(38vmin,420px);height:min(38vmin,420px);background:#fff;padding:2vmin;border-radius:1vmin}
.qr svg{display:block;width:100%;height:100%}
.foot{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(10px,1.4vmin,15px);
  color:#6FA089;margin:3vmin 0 0}
@media (max-width:900px),(orientation:portrait){
  .card{grid-template-columns:1fr;justify-items:center;text-align:center}
  .chal{border-left:0;border-top:.6vmin solid #DE3F26;padding:2.4vmin 0 0;text-align:left}
}
</style>
</head>
<body>
<main class="card">
  <div>
    <p class="eyebrow">EL3vate 2026 &middot; Day 8 &middot; 29 July</p>
    <h1>Prototyping <em>solutions</em></h1>
    <p class="chal">${esc(DAY10_CHALLENGE)}</p>
    <p class="urll">All fifteen assignments, demos and handouts</p>
    <p class="url">${esc(SITE_URL)}</p>
    <p class="foot">Tim Lum &middot; PACE &middot; Shidler College of Business &middot; University of Hawai&#699;i at M&#257;noa</p>
  </div>
  <div class="qr">${qrSvg}</div>
</main>
</body>
</html>
`;
}

// ============================================================
// phase 10 — presenter kit (dist/presenter/index.html)
// ============================================================
// The page the session is driven from, on conference wifi, possibly with no
// network at all. Everything is inlined: system fonts only, the QR as inline
// SVG, every demo still as a base64 data URI. Nothing on this page fetches
// anything. It is linked from nowhere on the public site and marked noindex;
// GATE 9 in src/validate.js enforces both of those, plus the no-subresource
// rule, so a later edit cannot quietly make it depend on the network.

const RUN_OF_SHOW = [
  { at: 0, mins: 5, title: 'Framing',
    detail: 'Who this is for and what they leave with. Two builds per assignment: one they make with their hands, one they build with AI. Nothing here needs them to learn a tool first.' },
  { at: 5, mins: 20, title: 'Maker space tour',
    detail: '3D printing, laser cutting, the Hana recording studio. Show the machines, not the slides. Point at what a student file turns into.' },
  { at: 25, mins: 5, title: 'Access logistics and recording studio',
    detail: 'Files go through the PACE request form from a UH email address. In-person access is by appointment and is separate from submitting a file — nobody has to come in to have something made. Turnaround is 7–10 BUSINESS days; say the word "business" out loud. Tim has the form link.' },
  { at: 30, mins: 20, title: 'AI live build',
    detail: 'Run the live-build prompt in a chat window and build a working interactive page in front of the room. Every discipline page has an empty live-build section reserved for whatever comes out.' },
  { at: 50, mins: 10, title: 'Challenge and prompt exercise',
    detail: 'They run the second prompt themselves, on their own course, on their own device. The graded skill is catching where the model is confidently wrong — every discipline page has a real annotated model output showing exactly that.' },
  { at: 60, mins: 5, title: 'Close',
    detail: 'The Day 10 challenge in one sentence, the URL and the QR on screen. Share the closing card full-screen.' },
];

// The two prompts rehearsed for the session. Both are real starter prompts from
// the site's own content — nothing here is written for the presenter page — and
// both are deliberately domain-neutral so every discipline in the room can run
// them. If Tim rehearsed different ones, change the two slugs; nothing else
// needs to move. Logged in BLOCKERS.md because the brief named "the two
// rehearsed prompts" without saying which they are.
const REHEARSED = [
  { slug: 'learning-design', at: '0:30', role: 'Live build',
    why: 'Built live in front of the room. Every faculty member has a concept and a learner, so the bracket fills itself from the audience. The a11y-audit demo further down this page is what this prompt produced.' },
  { slug: 'finance', at: '0:50', role: 'Challenge exercise',
    why: 'What they run themselves. Same build shape, applied to a decision in their own field — the break-even demo is what it produced, and its "every assumption this model makes" panel is the thing to point at.' },
];

const PRESENTER_CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0D211B;color:#EAF0EA;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-size:16px;line-height:1.5}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:1160px;margin:0 auto;padding:0 22px}
h1{font-size:1.8rem;line-height:1.1;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:1.15rem;margin:0 0 14px;letter-spacing:-.01em}
a{color:#8FE3C0}
:focus-visible{outline:3px solid #FF6A4D;outline-offset:2px}

.top{border-bottom:1px solid #2A4A3E;padding:22px 0 20px}
.top__grid{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.22em;
  text-transform:uppercase;color:#7FB79B;margin:0 0 10px}
.urlbox{display:flex;align-items:center;gap:18px;background:#123028;border:1px solid #2A4A3E;padding:14px 18px;border-radius:4px}
.urlbox .qr{width:132px;height:132px;background:#fff;padding:7px;border-radius:3px;flex:none}
.urlbox .qr svg{display:block;width:100%;height:100%}
.urlbox .u{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.35rem;color:#fff;word-break:break-all}
.urlbox .l{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:.16em;
  text-transform:uppercase;color:#7FB79B;margin:0 0 6px}

/* ---- timer ---- */
.timer{position:sticky;top:0;z-index:50;background:#0A1A15;border-bottom:2px solid #2A4A3E}
.timer__grid{display:grid;grid-template-columns:auto 1fr auto;gap:26px;align-items:center;padding:14px 0}
.clock{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:3.1rem;line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:#fff}
.clock.paused{color:#7FB79B}
.now__l{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:.16em;
  text-transform:uppercase;color:#7FB79B;margin:0 0 3px}
.now__t{font-size:1.3rem;font-weight:600;margin:0 0 4px;color:#fff}
.now__m{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#B7D3C4}
.remain{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.5rem;font-variant-numeric:tabular-nums}
.status{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;letter-spacing:.06em;
  text-transform:uppercase;padding:4px 10px;border-radius:3px;display:inline-block;margin-top:5px}
.status.on{background:#1E5744;color:#B8F0D6}
.status.long{background:#8E2A14;color:#FFD9CF}
.status.ahead{background:#1E4457;color:#BFE4F5}
.over{color:#FF9478}
.btns{display:flex;gap:8px;flex-wrap:wrap}
.btn{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;letter-spacing:.06em;
  text-transform:uppercase;padding:11px 16px;border-radius:3px;border:2px solid #35604F;
  background:#123028;color:#EAF0EA;cursor:pointer}
.btn:hover{border-color:#8FE3C0}
.btn--go{background:#DE3F26;border-color:#DE3F26;color:#fff}
.btn--go:hover{background:#FF6A4D;border-color:#FF6A4D}

/* ---- run of show ---- */
section{padding:30px 0;border-bottom:1px solid #1E3B31}
.ros{list-style:none;margin:0;padding:0}
.ros li{display:grid;grid-template-columns:76px 1fr auto;gap:18px;padding:13px 14px;align-items:start;
  border-left:4px solid transparent;border-radius:3px}
.ros li.cur{background:#123028;border-left-color:#DE3F26}
.ros li.done{opacity:.5}
.ros .mk{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.1rem;color:#8FE3C0;font-variant-numeric:tabular-nums}
.ros .ti{font-weight:700;font-size:1.05rem;margin:0 0 4px;color:#fff}
.ros .de{margin:0;font-size:14.5px;color:#B7D3C4;max-width:80ch}
.ros .du{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#7FB79B;white-space:nowrap}
.jumpbtn{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;background:none;border:1px solid #35604F;color:#8FE3C0;padding:5px 9px;
  border-radius:3px;cursor:pointer;margin-top:6px}
.jumpbtn:hover{border-color:#8FE3C0;color:#fff}

/* ---- prompts ---- */
.pr{border:1px solid #2A4A3E;border-radius:4px;background:#0F2620;margin:0 0 18px}
.pr__bar{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 16px;
  border-bottom:1px solid #2A4A3E;flex-wrap:wrap}
.pr__id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;letter-spacing:.14em;
  text-transform:uppercase;color:#8FE3C0}
.pr__why{padding:12px 16px 0;margin:0;font-size:14.5px;color:#B7D3C4;max-width:88ch}
.pr__t{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.65;margin:0;
  padding:14px 16px;white-space:pre-wrap;word-break:break-word;color:#fff}

/* ---- demos ---- */
.dm{border:1px solid #2A4A3E;border-radius:4px;background:#0F2620;margin:0 0 14px;overflow:hidden}
.dm__bar{display:grid;grid-template-columns:38px 1fr auto;gap:14px;align-items:center;padding:13px 16px}
.dm__n{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.2rem;color:#DE3F26;font-weight:700}
.dm__t{font-weight:700;color:#fff;margin:0 0 2px}
.dm__s{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:#7FB79B}
.dm__go{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.08em;
  text-transform:uppercase;background:#123028;border:2px solid #35604F;color:#EAF0EA;padding:10px 14px;
  border-radius:3px;text-decoration:none;white-space:nowrap}
.dm__go:hover{border-color:#8FE3C0;color:#fff}
.dm details{border-top:1px solid #2A4A3E}
.dm summary{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.06em;
  text-transform:uppercase;padding:11px 16px;cursor:pointer;color:#8FE3C0}
.dm summary:hover{color:#fff;background:#123028}
.dm img{display:block;width:100%;height:auto;background:#fff;border-top:1px solid #2A4A3E}
.dm .cap{font-size:13px;color:#B7D3C4;padding:10px 16px;margin:0}

.note{background:#123028;border-left:4px solid #DE3F26;padding:14px 18px;margin:0 0 20px;font-size:14.5px;color:#D7E4DA;max-width:96ch}
footer{padding:26px 0 40px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:#6FA089}
@media (max-width:900px){
  .top__grid,.timer__grid{grid-template-columns:1fr;gap:16px}
  .ros li{grid-template-columns:60px 1fr}
  .clock{font-size:2.4rem}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const PRESENTER_JS = seg => `
"use strict";
var SEG = ${JSON.stringify(seg)};
var TOTAL = SEG[SEG.length-1].at*60 + SEG[SEG.length-1].mins*60;
var running=false, elapsed=0, last=0, cur=0, curStart=0;

function fmt(s){
  var neg = s<0; s=Math.abs(Math.floor(s));
  return (neg?"-":"")+Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
// Counters that count DOWN round up, so a 5-minute segment reads "5:00 left"
// for its first second instead of dropping to 4:59 the moment it starts, and
// hits 0:00 exactly as the budget runs out. Takes a non-negative magnitude.
function fmtUp(s){
  s = Math.ceil(s);
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function el(id){ return document.getElementById(id); }

function render(){
  var s = SEG[cur];
  var segElapsed = elapsed - curStart;
  var remain = s.mins*60 - segElapsed;

  // How far past plan the session finishes if we stopped right now: lateness
  // getting into this segment, plus anything spent over its own budget.
  var plannedSoFar = s.at*60 + Math.min(segElapsed, s.mins*60);
  var drift = elapsed - plannedSoFar;

  el("clock").textContent = fmt(elapsed);
  el("clock").className = "clock" + (running ? "" : " paused");
  el("segTitle").textContent = s.title;
  el("segMeta").textContent = "target " + s.label + " \\u2192 " + s.endLabel + "  \\u00b7  " + s.mins + " min budget";
  el("remain").textContent = remain >= 0 ? fmtUp(remain) + " left" : fmtUp(-remain) + " OVER";
  el("remain").className = "remain" + (remain < 0 ? " over" : "");

  var st = el("status");
  if (drift > 30) { st.className="status long"; st.textContent = "Running long by " + fmtUp(drift); }
  else if (drift < -30) { st.className="status ahead"; st.textContent = "Ahead by " + fmtUp(-drift); }
  else { st.className="status on"; st.textContent = "On plan"; }

  el("startBtn").textContent = running ? "Pause" : (elapsed>0 ? "Resume" : "Start");
  for (var i=0;i<SEG.length;i++){
    var li = el("ros"+i);
    li.className = i===cur ? "cur" : (i<cur ? "done" : "");
  }
}
function tick(){
  if (running) { var now = Date.now(); elapsed += (now-last)/1000; last = now; }
  render();
}
function toggle(){ running = !running; last = Date.now(); render(); }
function goto(i){ if(i<0||i>=SEG.length) return; cur = i; curStart = elapsed; render(); }
function reset(){ running=false; elapsed=0; cur=0; curStart=0; render(); }

el("startBtn").addEventListener("click", toggle);
el("nextBtn").addEventListener("click", function(){ goto(cur+1); });
el("prevBtn").addEventListener("click", function(){ goto(cur-1); });
el("resetBtn").addEventListener("click", function(){
  if (elapsed > 5 && !confirmReset()) return; reset();
});
var armed=false;
function confirmReset(){
  // no modal dialogs on a page being driven live — a second click within 3s
  var b=el("resetBtn");
  if (armed) { armed=false; b.textContent="Reset"; return true; }
  armed=true; b.textContent="Reset — click again";
  setTimeout(function(){ armed=false; b.textContent="Reset"; }, 3000);
  return false;
}
Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function(b){
  b.addEventListener("click", function(){ goto(+b.dataset.goto); });
});
document.addEventListener("keydown", function(e){
  var t = e.target.tagName;
  if (t==="INPUT"||t==="TEXTAREA"||t==="SELECT") return;   // never hijack text entry
  if (e.key===" ") {
    // Space is the native activation key for whatever control has focus, so let
    // it through rather than firing twice. Every control it can land on here
    // (Start/Pause, Next, a still's summary) is one the presenter meant to hit.
    if (t==="BUTTON"||t==="SUMMARY"||t==="A") return;
    e.preventDefault(); toggle();
  }
  // N and P must keep working after a control has been clicked with the mouse.
  // Excluding BUTTON here would silently kill the shortcuts the moment anyone
  // pressed Start with the trackpad, which is exactly how the session starts.
  else if (e.key==="n"||e.key==="N"||e.key==="ArrowRight") { e.preventDefault(); goto(cur+1); }
  else if (e.key==="p"||e.key==="P"||e.key==="ArrowLeft") { e.preventDefault(); goto(cur-1); }
});

// one-click copy, with a fallback for file:// where the async clipboard API is
// often unavailable — this page has to work opened straight off a disk
Array.prototype.forEach.call(document.querySelectorAll(".copy"), function(btn){
  btn.addEventListener("click", function(){
    var src = document.getElementById(btn.dataset.target);
    var txt = src ? src.textContent : "";
    var done = function(){ btn.textContent="Copied"; setTimeout(function(){ btn.textContent="Copy prompt"; },1600); };
    var fb = function(){
      var ta=document.createElement("textarea"); ta.value=txt; ta.setAttribute("readonly","");
      ta.style.position="fixed"; ta.style.left="-9999px"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch(e) { btn.textContent="Copy failed"; }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fb);
    else fb();
  });
});
setInterval(tick, 250);
render();
`;

function loadAsset(rel) {
  const p = path.join(ROOT, 'assets', rel);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

function renderPresenter(all, bySlug) {
  // --- QR, with a staleness guard ---
  const qrSvg = loadAsset('qr.svg');
  const qrMeta = loadAsset('qr.json');
  if (!qrSvg || !qrMeta) throw new Error('assets/qr.svg or assets/qr.json missing — run `node src/qr.js`');
  const encoded = JSON.parse(qrMeta.toString('utf8')).url;
  if (encoded !== SITE_URL) {
    throw new Error(`QR staleness check FAILED: assets/qr.svg encodes ${encoded} but SITE_URL is ` +
      `${SITE_URL}. Re-run \`node src/qr.js\`. Refusing to ship a QR code that points somewhere else.`);
  }

  // --- run of show, with labels derived from the markers ---
  const label = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const seg = RUN_OF_SHOW.map(s => ({ ...s, label: label(s.at), endLabel: label(s.at + s.mins) }));

  const ros = seg.map((s, i) => `
    <li id="ros${i}">
      <span class="mk">${s.label}</span>
      <span>
        <p class="ti">${esc(s.title)}</p>
        <p class="de">${esc(s.detail)}</p>
        <button class="jumpbtn" type="button" data-goto="${i}">I&rsquo;m here now</button>
      </span>
      <span class="du">${s.mins} min<br>&rarr; ${s.endLabel}</span>
    </li>`).join('');

  // --- the two rehearsed prompts ---
  const prompts = REHEARSED.map((r, i) => {
    const d = bySlug[r.slug];
    if (!d) throw new Error(`REHEARSED prompt references unknown discipline "${r.slug}"`);
    return `
    <div class="pr">
      <div class="pr__bar">
        <span class="pr__id">${esc(r.at)} &middot; ${esc(r.role)} &middot; from ${esc(d.name)}</span>
        <button class="btn copy" type="button" data-target="rp${i}">Copy prompt</button>
      </div>
      <p class="pr__why">${esc(r.why)}</p>
      <pre class="pr__t" id="rp${i}">${esc(d.prompt)}</pre>
    </div>`;
  }).join('');

  // --- demos, in presentation order (the hub's part order) ---
  const withDemos = all.filter(d => d.demo).sort((a, b) => a.part - b.part);
  const missing = [];
  const demos = withDemos.map((d, i) => {
    const png = loadAsset(path.join('screens', d.demo + '.png'));
    let still;
    if (png) {
      still = `<img src="data:image/png;base64,${png.toString('base64')}"
        alt="Fallback still of the ${escAttr(d.name)} demo, for narrating from if it will not load">
      <p class="cap">Fallback still &mdash; if the demo will not load, talk through this without leaving the page.</p>`;
    } else {
      missing.push(d.demo);
      still = `<p class="cap">No fallback still captured for this demo. Run <code>node src/screens.js</code>.</p>`;
    }
    return `
    <div class="dm">
      <div class="dm__bar">
        <span class="dm__n">${i + 1}</span>
        <span>
          <p class="dm__t">${esc(d.name)}</p>
          <span class="dm__s">${esc(d.demo)} &middot; Part ${String(d.part).padStart(2, '0')} &middot; runs offline</span>
        </span>
        <a class="dm__go" href="../demos/${esc(d.demo)}/index.html" target="_blank" rel="noopener">Open &nearr;</a>
      </div>
      <details>
        <summary>Show fallback still</summary>
        ${still}
      </details>
    </div>`;
  }).join('');
  if (missing.length) console.warn(`  WARNING: presenter page missing stills for: ${missing.join(', ')}`);

  const body = `
<div class="timer"><div class="wrap timer__grid">
  <div class="clock paused" id="clock">0:00</div>
  <div>
    <p class="now__l">Current segment</p>
    <p class="now__t" id="segTitle">Framing</p>
    <p class="now__m mono" id="segMeta"></p>
  </div>
  <div>
    <div class="remain" id="remain"></div>
    <div><span class="status on" id="status">On plan</span></div>
    <div class="btns" style="margin-top:10px">
      <button class="btn btn--go" type="button" id="startBtn">Start</button>
      <button class="btn" type="button" id="prevBtn">&larr; Prev</button>
      <button class="btn" type="button" id="nextBtn">Next &rarr;</button>
      <button class="btn" type="button" id="resetBtn">Reset</button>
    </div>
  </div>
</div></div>

<header class="top"><div class="wrap top__grid">
  <div>
    <p class="eyebrow">Presenter kit &middot; not linked from the site &middot; works offline</p>
    <h1>EL3vate 2026 &middot; Day 8 &middot; Prototyping Solutions</h1>
    <p class="mono" style="color:#B7D3C4;margin:0">Wednesday 29 July &middot; Tim Lum &middot; PACE, Shidler College of Business</p>
  </div>
  <div class="urlbox">
    <div class="qr">${qrSvg.toString('utf8')}</div>
    <div>
      <p class="l">Put this on the screen</p>
      <div class="u">${esc(SITE_URL)}</div>
    </div>
  </div>
</div></header>

<main>
<section><div class="wrap">
  <h2>Run of show</h2>
  <p class="note"><strong>Space</strong> starts and pauses. <strong>N</strong> / <strong>P</strong> (or the arrow keys)
  move between segments &mdash; press N when you actually move on, and the timer will tell you whether the session is
  running long rather than silently sliding the plan. Every segment below has an &ldquo;I&rsquo;m here now&rdquo; button
  that does the same thing.</p>
  <ol class="ros">${ros}</ol>
</div></section>

<section><div class="wrap">
  <h2>The two rehearsed prompts</h2>
  ${prompts}
</div></section>

<section><div class="wrap">
  <h2>Demos, in the order they are shown</h2>
  <p class="note">Every demo opens in a new tab and runs entirely offline against canned data &mdash; no keys, no
  network, safe on conference wifi. If one will not open, expand its fallback still and narrate from the picture.</p>
  ${demos}
</div></section>

<section><div class="wrap">
  <h2>If everything breaks</h2>
  <p class="note">The whole site is static. Nothing on it needs a server, an account or a key. Fallbacks in order:
  the demo tabs above &rarr; the fallback stills on this page &rarr; <a href="../all-handouts.html">all-handouts.html</a>
  (46 pages, every assignment) &rarr; the printed handouts. At 1:00, share
  <a href="../closing-card.html" target="_blank" rel="noopener">closing-card.html</a> full-screen &mdash; the URL,
  the QR and the Day 10 challenge on one slide. Every discipline page also carries a feedback link that opens a
  pre-addressed mail draft.</p>
</div></section>
</main>

<footer><div class="wrap">Presenter kit &middot; build ${SHA} &middot; ${esc(SITE_URL)} &middot; noindex, linked from nowhere</div></footer>
`;

  return `<!DOCTYPE html>
${STAMP}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Presenter kit · EL3vate 2026 Day 8</title>
<style>${PRESENTER_CSS}</style>
</head>
<body>
${body}
<script>${PRESENTER_JS(seg)}</script>
</body>
</html>
`;
}

// ---- main ----
// ---- phase 7: human-readable claim audit page (dist/audit.html) ----
function renderAudit(claims) {
  const items = (claims && claims.claims) || [];
  const counts = { refuted: 0, unverifiable: 0, verified: 0 };
  items.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
  const rank = s => (s === 'refuted' ? 0 : s === 'unverifiable' ? 1 : s === 'verified' ? 2 : 9);
  const sorted = items.slice().sort((a, b) => rank(a.status) - rank(b.status) || String(a.id).localeCompare(String(b.id)));
  const cards = sorted.map(c => {
    const src = c.verifiedAgainst
      ? `<a href="${escAttr(c.verifiedAgainst)}" rel="noopener noreferrer">${esc(c.verifiedAgainst)}</a>`
      : `<span class="muted">no independent source found</span>`;
    return `<article class="claimrow claimrow--${esc(c.status)}">
      <div class="claimrow__hd"><span class="cid">${esc(c.id)}</span><span class="stbadge stbadge--${esc(c.status)}">${esc(c.status)}</span></div>
      <p class="claimrow__q">&ldquo;${esc(String(c.claim))}&rdquo;</p>
      <p class="claimrow__meta">${esc(c.file)} &middot; ${esc(c.field)}</p>
      ${c.note ? `<p class="claimrow__note">${esc(c.note)}</p>` : ''}
      <p class="claimrow__src">Checked against: ${src}</p>
    </article>`;
  }).join('\n');
  const auditedAt = claims && claims.auditedAt ? ` (${esc(claims.auditedAt)})` : '';
  const body = `
<header class="hero"><div class="wrap hero__inner">
  <a class="backlink" href="index.html">&larr; All 15 disciplines</a>
  <p class="eyebrow">EL3vate 2026 &middot; Day 8 &middot; Claim audit</p>
  <h1>Every factual claim on this site, checked</h1>
  <p class="hero__sub">${items.length} claims were extracted from the discipline content and verified independently${auditedAt}: <strong>${counts.verified} verified</strong>, <strong>${counts.refuted} refuted</strong>, <strong>${counts.unverifiable} unverifiable</strong>. Refuted claims were rewritten out of the site, or &mdash; where they sit inside a preserved model transcript &mdash; named in that transcript&rsquo;s annotations. Load-bearing unverifiable figures stay on their pages inside a visible <span class="unv__t">unverified</span> mark.</p>
</div></header>
<main class="disc"><div class="wrap">
  <div class="auditlist">${cards}</div>
</div></main>
<footer><div class="wrap">EL3vate 2026 &middot; Day 8 &middot; Claim audit &middot; Build ${SHA}</div></footer>`;
  return page('Claim audit · EL3vate 2026 Day 8', 'Every factual claim on the EL3vate Day 8 site, independently checked, with sources.', body);
}

function main() {
  const all = load();
  const bySlug = Object.fromEntries(all.map(d => [d.slug, d]));
  rmrf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  // hub
  fs.writeFileSync(path.join(DIST, 'index.html'), renderHub(all));

  // claim audit page (phase-7 audit, rendered human-readable so the on-page note
  // links to a real dist/ artifact rather than the repo-only content/claims.json)
  fs.writeFileSync(path.join(DIST, 'audit.html'), renderAudit(CLAIMS));

  // discipline pages + handouts (markdown, plus a print-styled HTML rendering of
  // that same markdown — src/pdf.js turns the HTML into handout.pdf when a
  // renderer is available, and the HTML stands as the artifact when it is not)
  const sheets = [];
  for (const d of all) {
    const dir = path.join(DIST, d.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderDiscipline(d, all, bySlug));

    const mdPath = path.join(dir, 'handout.md');
    fs.writeFileSync(mdPath, renderHandout(d));
    // read back from disk so the printed artifact is provably the file on disk,
    // not a second rendering of the same data that could drift from it
    const sheet = `<div class="hsheet">${mdToHtml(fs.readFileSync(mdPath, 'utf8'))}</div>`;
    sheets.push(sheet);
    fs.writeFileSync(path.join(dir, 'handout.html'),
      handoutDoc(`${d.name} — handout · EL3vate 2026 Day 8`, sheet));
  }

  // one combined handout of all fifteen, with a contents page
  const toc = all.map(d =>
    `<li>Part ${String(d.part).padStart(2, '0')} &middot; ${esc(d.name)}</li>`).join('');
  const cover = `<div class="hsheet">
<h1>Prototyping Solutions &mdash; all fifteen handouts</h1>
<p class="meta">EL3vate 2026 &middot; Day 8 &middot; 29 July &middot; build ${SHA}</p>
<p>One &ldquo;steal this&rdquo; handout per discipline: a 90-minute version, the full assignment,
the multi-week plan, what it replaces, where AI fails at it, a rubric, the starter prompt,
budget and three sizes.</p>
<p>Everything here, plus the interactive demos and the annotated model outputs, is at
<strong>${esc(SITE_URL)}</strong></p>
<h2>Contents</h2>
<ul class="toc">${toc}</ul>
<hr>
<p class="meta">PACE &middot; Shidler College of Business &middot; University of Hawai&#699;i at M&#257;noa</p>
</div>`;
  fs.writeFileSync(path.join(DIST, 'all-handouts.html'),
    handoutDoc('All fifteen handouts · EL3vate 2026 Day 8', cover + '\n' + sheets.join('\n')));

  // demos
  copyDir(DEMOS, path.join(DIST, 'demos'));

  // session-day artifacts: the standalone QR (static SVG, no script, no
  // dependency) and the full-screen closing card
  const qr = loadAsset('qr.svg');
  if (!qr) throw new Error('assets/qr.svg missing — run `node src/qr.js`');
  fs.writeFileSync(path.join(DIST, 'qr.svg'), qr);
  fs.writeFileSync(path.join(DIST, 'closing-card.html'), renderClosingCard(qr.toString('utf8')));

  // presenter kit — linked from nowhere on the public site, noindex, fully offline
  fs.mkdirSync(path.join(DIST, 'presenter'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'presenter', 'index.html'), renderPresenter(all, bySlug));

  console.log(`built ${all.length} discipline pages + hub into dist/ (build ${SHA} ${ISO})`);
  console.log(`SITE_URL = ${SITE_URL}`);
  console.log(`FEEDBACK_EMAIL = ${FEEDBACK_EMAIL}`);
  console.log(`ALIASES = ${ALIASES.join(', ') || '(none)'}  [display only — never SITE_URL]`);
  console.log(`USE_SUPABASE = ${USE_SUPABASE}  url=${SUPABASE_URL ? 'set' : 'empty'}  key=${SUPABASE_ANON_KEY ? 'set' : 'empty'}` +
    `  ->  feedback backend ${SUPABASE_ON ? 'ON (form emitted)' : 'OFF (mailto only)'}`);
}
main();
