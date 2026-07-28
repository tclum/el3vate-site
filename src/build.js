// Static site generator for the EL3vate Day 8 site.
// Reads content/*.json + demos/, emits dist/. Plain Node, zero dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
@media print{.hero,.tt{background:#fff;color:#000}.hero *,.tt *{color:#000!important}.chips,.jump,.copy{display:none}.sec{break-inside:avoid}}
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

<footer><div class="wrap">EL3vate 2026 &middot; Day 8 session resource &middot; Prepared for the faculty cohort &middot; Build ${SHA}</div></footer>
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
    : `<p class="tag">Reserved &middot; live build</p><p>This space is intentionally empty. During the Day 8 session it will be filled in live &mdash; fill the <code>liveBuild</code> field in <code>content/${esc(d.slug)}.json</code> and rebuild.</p>`;
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
  <p style="margin-top:26px"><a href="handout.md">Download the &ldquo;steal this&rdquo; handout (Markdown) &rarr;</a></p>
</div></main>

<footer><div class="wrap">EL3vate 2026 &middot; Day 8 &middot; ${esc(d.name)} &middot; Build ${SHA}</div></footer>
`;
  return page(`${d.name} · EL3vate 2026 Day 8`,
    `Prototyping assignment for ${d.name}: a 90-minute version, ${planWeeks(d)}-week plan, rubric, budget, and a real annotated AI output.`,
    body, COPY_JS);
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

  // discipline pages + handouts
  for (const d of all) {
    const dir = path.join(DIST, d.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderDiscipline(d, all, bySlug));
    fs.writeFileSync(path.join(dir, 'handout.md'), renderHandout(d));
  }

  // demos
  copyDir(DEMOS, path.join(DIST, 'demos'));

  console.log(`built ${all.length} discipline pages + hub into dist/ (build ${SHA} ${ISO})`);
}
main();
