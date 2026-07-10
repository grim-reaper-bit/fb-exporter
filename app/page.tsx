/**
 * app/page.tsx — the protected showcase.
 *
 * Reached only when middleware confirms a valid session (otherwise redirected to
 * /login). Presents what the Comment Exporter extension is: overview, features,
 * output schema, screenshots, and install guide.
 */
import LogoutButton from './LogoutButton';
import ShotImage from './ShotImage';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const features = [
  { k: 'Top-level', h: 'Full thread, no ceiling', p: 'Replays the comment query with advancing cursors to reach the complete count — past the point where a scrolling page drops older comments.' },
  { k: 'Replies', h: 'Nested, to depth two', p: 'Auto-expands "View replies" across the whole thread in one pass and harvests the responses, threading replies-to-replies correctly.' },
  { k: 'Ordering', h: 'Fullest set by default', p: 'Switches the post to "All comments" using Facebook\'s own sort control, so filtered and low-visibility comments aren\'t quietly left out.' },
  { k: 'Integrity', h: 'Threaded and reconciled', p: 'Every row carries depth, reply flag, and parent id. Parents dropped mid-capture are reconstructed from reply data so no thread is orphaned.' },
  { k: 'Control', h: 'Speed and stop, on the page', p: 'Safe / Normal / Fast pacing to manage rate, plus a stop button that always saves what\'s gathered — in a panel that stays put mid-run.' },
  { k: 'Trust', h: 'Guarded against bad exports', p: 'A tested honesty guard refuses to fabricate a dataset when capture fails, warning loudly instead of handing over a broken file.' },
];

const columns = ['post_url','post_id','post_author','exported_at','account_id','comment_id','parent_comment_id','depth','isReply','author','profileUrl','text','createdTime','likes','replyCount'];

const shots = [
  { c: '01 · control panel', cap: 'Format, speed, replies, and the export button — the on-page control surface.', f: 'panel.png' },
  { c: '02 · live progress', cap: 'The capture log and progress bar while the engine walks the thread.', f: 'progress.png' },
  { c: '03 · export summary', cap: 'Totals, depth breakdown, reconstructed parents, orphan count, coverage.', f: 'summary.png' },
  { c: '04 · output file', cap: 'The resulting CSV opened in a spreadsheet — threaded and ready.', f: 'csv.png' },
];

const steps = [
  { h: 'Gather the files in one folder', p: <>manifest.json, interceptor.js, content.js, popup.html, popup.js — no nested duplicates, no leftover old files.</> },
  { h: 'Open the extensions page', p: <>Go to <code>chrome://extensions</code> and turn on <b>Developer mode</b> (top-right).</> },
  { h: 'Load unpacked', p: <>Click <b>Load unpacked</b> and select the folder. To update after an edit, click the <b>↻ reload</b> icon on the card.</> },
  { h: 'Open a post and export', p: <>On a Facebook post, click the extension → <b>Open exporter panel</b>. Set options, then <b>Export Comments</b>. Files download locally.</> },
];

export default async function Showcase() {
  const admin = await requireAdmin();
  return (
    <>
      <header className="bar">
        <div className="wrap">
          <div className="brand"><span className="sig" />Comment Exporter</div>
          <nav className="top">
            <a href="#what">Overview</a>
            <a href="#features">Features</a>
            <a href="#output">Output</a>
            <a href="#shots">Screenshots</a>
            <a href="#install">Install</a>
            <a href="/reddit">Reddit tool</a>
            <a href="/youtube">YouTube tool</a>
            {admin && <a href="/admin">Admin</a>}
          </nav>
          <LogoutButton />
        </div>
      </header>

      <div className="hero">
        <div className="wrap">
          <div className="eyebrow">Personal research instrument · v3.15.0</div>
          <h1>A Facebook comment capture engine that <em>replays the source</em>, not the screen.</h1>
          <p className="lede">
            A Chrome extension that exports every comment and nested reply on a single
            post to clean CSV and JSON — by replaying Facebook&apos;s own requests and
            harvesting its own responses, so nothing gets lost to a scrolling page.
          </p>
          <div className="meta">
            <span className="chip"><b>Reaches</b> full comment counts</span>
            <span className="chip"><b>Threads</b> replies to depth 2</span>
            <span className="chip"><b>Refuses</b> to export corrupt data</span>
          </div>
          <div className="logstrip" aria-hidden="true">
            <div className="lhead"><span className="d" />capture log</div>
            <div className="lbody">
              <span className="ln"><span className="t">›</span> Post: Philippine Star · id 1546784977485376</span><br />
              <span className="ln"><span className="t">›</span> Forcing &quot;All comments&quot; ordering — restarting from first page</span><br />
              <span className="ln"><span className="t">›</span> Top-level captured: 1,344</span><br />
              <span className="ln"><span className="t">›</span> Reply expansion: 639 groups clicked → 757 reply rows</span><br />
              <span className="ln"><span className="t">›</span> Reconstructed 10 missing parents · orphans: 0</span><br />
              <span className="ln"><span className="ok">✓ Done — 2,101 comments · files saved locally</span></span>
            </div>
          </div>
        </div>
      </div>

      <section id="what">
        <div className="wrap">
          <div className="seclabel">What it is</div>
          <h2>An operator&apos;s tool, not a scraper of screens</h2>
          <p className="lead">
            Reading a rendered page misses comments the moment they scroll out of view —
            the browser throws them away. This tool instead captures Facebook&apos;s own
            comment query as it fires, then replays it with advancing cursors to walk the
            entire thread. Replies are gathered the same honest way: it clicks Facebook&apos;s
            real &quot;View replies&quot; controls and keeps what Facebook sends back.
          </p>
          <div className="grid">
            <div className="card"><div className="k">Principle</div><h3>Let the source do the work</h3>
              <p>Every request is Facebook&apos;s own, with live tokens captured in the moment — never forged, never hardcoded, so it survives token rotation.</p></div>
            <div className="card"><div className="k">Principle</div><h3>Honest or not at all</h3>
              <p>If top-level capture fails, the run is flagged Incomplete rather than dressed up as success. A green checkmark always means real data.</p></div>
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="seclabel">Capabilities</div>
          <h2>What it does</h2>
          <div className="grid">
            {features.map((f) => (
              <div className="card" key={f.k}>
                <div className="k">{f.k}</div>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="output">
        <div className="wrap">
          <div className="seclabel">Output</div>
          <h2>Clean columns, ready for analysis</h2>
          <p className="lead">
            Each export is CSV and JSON with a stable schema.{' '}
            <span style={{ color: 'var(--amber)', fontFamily: 'var(--mono)' }}>account_id</span>{' '}
            is the numeric author key that lets a downstream detector join the same person across many posts.
          </p>
          <div className="datablock">
            <div className="dh">export schema — 15 fields</div>
            <div className="dcols">
              {columns.map((c) => (
                <span className={`col${c === 'account_id' ? ' key' : ''}`} key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="shots">
        <div className="wrap">
          <div className="seclabel">Screens</div>
          <h2>Screenshots</h2>
          <p className="lead">Real captures from the tool in use. Drop images named <code>panel.png</code>, <code>progress.png</code>, <code>summary.png</code>, and <code>csv.png</code> into <code>/public</code> to show them here.</p>
          <div className="shots">
            {shots.map((s) => (
              <div className="shot" key={s.c}>
                <div className="cap">{s.c}</div>
                <ShotImage file={s.f} />
                <div className="cap2">{s.cap}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="install">
        <div className="wrap">
          <div className="seclabel">Setup</div>
          <h2>Install guide</h2>
          <p className="lead">Loaded unpacked in Chrome. No store, no account — it runs locally on your machine.</p>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step" key={i}>
                <span className="n" />
                <div><h4>{s.h}</h4><p>{s.p}</p></div>
              </div>
            ))}
          </div>
          <div className="callout">
            <b>Note.</b> This automates data collection on Facebook, which is against its
            Terms of Service, and the exports contain other people&apos;s personal data. Keep
            it personal, keep exports local, and don&apos;t distribute the tool.
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <span>Comment Exporter · v3.15.0 · developed by Baydz</span>
          <span>registered access · not indexed</span>
        </div>
      </footer>
    </>
  );
}