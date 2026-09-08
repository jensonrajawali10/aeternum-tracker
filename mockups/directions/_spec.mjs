// Written spec for each direction — injected into _template.html by _build.mjs.
// Kept out of the template so the prose stays editable without touching the harness.

const sw = (name, hex, note) =>
  `<div class="sw"><div class="chip" style="background:${hex}"></div><div class="m"><b>${name}</b><code>${hex}</code>${note ? `<code style="display:block">${note}</code>` : ''}</div></div>`;

const row = (a, b, c) => `<tr><td>${a}</td><td>${b}</td><td>${c || ''}</td></tr>`;

const table = (heads, rows) =>
  `<div class="scroll"><table class="tbl"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;

const motion = (does, never, keys) => `
<div class="rules">
  <div class="rule does"><div class="l">Animates</div><ul>${does.map(d => `<li>${d}</li>`).join('')}</ul></div>
  <div class="rule never"><div class="l">Never animates</div><ul>${never.map(d => `<li>${d}</li>`).join('')}</ul></div>
</div>
<h3 class="sub">Keyboard &amp; focus</h3>${keys}`;

const head = (ltr, nm, gn, file) => `
<div class="spec" id="spec-${ltr.toLowerCase()}">
  <div class="dh"><span class="ltr">${ltr}</span><h2>${nm}</h2><span class="gn">${gn}</span>
    <span class="open"><a href="${file}" target="_blank" rel="noopener">Open full size &#8599;</a></span></div>`;

/* ══════════════════════════════ A · LEDGER ══════════════════════════════ */
const a = head('A', 'Ledger', 'Paper &middot; editorial &middot; two-ink', 'a-ledger.html') + `
<p class="thesis">A cockpit built like an <b>audited workpaper</b>, not a trading screen. It takes the position that
the defining act of a concentrated fund is not reacting but <em>deciding</em> &mdash; you hold one to three names and
pass more than you act, so the interface that matters is the one you read, think in, and write your thesis into.
Paper ground, ink figures, hairline rules, zero radius, zero shadow. Separation comes from rules and whitespace,
never from boxes; a panel is a rule with a label above it. It is also the only direction that is already
<b>your brand</b> &mdash; the serif wordmark, Roman numerals and 0.5px hairlines come straight off the Aeternum
Capital site, applied to the product for the first time.</p>

<div class="stances">
  <div><div class="l">Optimises for</div><p>Reading, judgment and long-form context. Memos, journal, catalysts, thesis review. Numbers you study rather than watch.</p></div>
  <div><div class="l">For whom</div><p>A CIO whose edge is analytical, not reflexive. Someone who reads the local papers to change the model.</p></div>
  <div><div class="l">Rejects</div><p>Trader adrenaline. Glow, gloss, cards, drop shadows, dark-by-default as a signal of seriousness.</p></div>
</div>

<h3 class="sub">Colour &mdash; light (home)</h3>
<div class="swatches">
  ${sw('paper', '#F4F2EC', 'ground')}${sw('sheet', '#FBFAF7', 'hover / rail')}${sw('ink', '#15140F', 'body 16.5:1')}
  ${sw('ink-2', '#4A4740', 'secondary 8.3:1')}${sw('ink-3', '#726E64', 'muted 4.5:1')}${sw('accent', '#1F4B73', 'fountain-pen blue')}
  ${sw('up', '#186237', 'gain 6.6:1')}${sw('down', '#9B2A1E', 'loss 6.8:1')}${sw('caution', '#7A5310', 'watch 5.7:1')}
</div>
<h3 class="sub">Colour &mdash; dark (oil lamp)</h3>
<div class="swatches">
  ${sw('paper', '#16150F', 'warm, never neutral black')}${sw('sheet', '#1E1C15', '')}${sw('ink', '#EFEDE4', '15.6:1')}
  ${sw('ink-2', '#BAB5A7', '8.9:1')}${sw('ink-3', '#928D80', '5.5:1')}${sw('accent', '#9CC5E6', '')}
  ${sw('up', '#63CE8E', '9.4:1')}${sw('down', '#EE8073', '6.9:1')}${sw('caution', '#DDAF45', '9.0:1')}
</div>
<p class="thesis" style="font-size:14px;margin-top:12px">Dark mode is a <b>warm</b> inversion, not a neutral one &mdash;
paper under a lamp rather than a screen at night. <code>ink-4</code> exists but is decoration only (rules, tick marks);
no text tier sits below 4.5:1.</p>

<h3 class="sub">Typography</h3>
${table(['Role', 'Face &amp; size', 'Detail'], [
  row('Page title', 'Newsreader 29/1.0, weight 400', 'Tracking &minus;0.015em. Never bold &mdash; size carries it.'),
  row('Section head', 'Newsreader 17, weight 400', 'Preceded by a Roman numeral in italic, then a 1px rule at 30% ink.'),
  row('Section note', 'Newsreader italic 11', 'Sits on the same baseline as the head; carries scope and count.'),
  row('UI / labels', 'IBM Plex Sans 9.5 &middot; 500 &middot; 0.16em caps', 'Column heads, KPI labels.'),
  row('Body / nav', 'IBM Plex Sans 12.5/1.45', ''),
  row('All figures', 'IBM Plex Mono, tnum + zero', 'Slashed zero on. Right-aligned in every numeric column.'),
  row('KPI figure', 'IBM Plex Mono 20 &middot; 500 &middot; &minus;0.02em', 'Unit suffix drops to 12px in ink-3.'),
  row('Prose in feed', 'Newsreader 13.5/1.42', 'Tickers inline in mono 12/600 so they pop out of the sentence.'),
])}

<h3 class="sub">Density &amp; space</h3>
${table(['Token', 'Value', 'Note'], [
  row('Base', '12.5px / 1.45', 'Comfortable reading; compact mode drops to 12px / 1.4.'),
  row('Table row', '27px', 'Roughly 40 rows per 1080px viewport.'),
  row('Rhythm', '4 / 7 / 11 / 16 / 26 / 32', 'Odd steps on purpose &mdash; typographic, not an 8pt grid.'),
  row('Section gap', '32px', 'The rule does the separating, so the gap can stay tight.'),
  row('Panel padding', '16&ndash;20px', 'Left padding is 0 where a rule already marks the edge.'),
])}

<h3 class="sub">Border, radius, elevation</h3>
${table(['Property', 'Value', 'Rule'], [
  row('Radius', '0 &mdash; everywhere', 'No exceptions. Not on buttons, tags, inputs or bars.'),
  row('Elevation', 'None. No shadow token exists.', 'Depth is expressed by rule weight only.'),
  row('Rule weights', '9% hair &middot; 16% standard &middot; 30% section &middot; 2px ink for totals', 'Four weights, each with a job. A 2px ink rule means "this is a total".'),
  row('Fills', 'Reserved for bars and the hover sheet', 'A filled rectangle is data, never chrome.'),
])}

<h3 class="sub">Component vocabulary</h3>
${table(['Component', 'Form', 'Behaviour'], [
  row('Stat tile', 'Not a tile. Label, figure, delta, italic footnote, split by a 9% vertical hairline.', 'Hover lifts the ground to sheet. No border ever appears.'),
  row('Table row', '27px, hairline under, mono right-aligned figures, ticker in mono 600 with an italic serif company name beside it.', 'Hover paints sheet. Totals row sits under a 2px ink rule.'),
  row('Chart', 'Line only. NAV in solid ink, JCI dashed 5/3, S&amp;P dotted 1/3 &mdash; separable in greyscale and in print.', 'Hairline gridlines at 9%. No fills except the drawdown envelope at 10%.'),
  row('Nav item', 'Indented text; active gets a 5px square ink-blue bullet in the gutter and 500 weight.', 'Group heads are Roman numerals with a trailing hairline.'),
  row('Badge / pill', 'A ruled mark: 1px border, 0 radius, 9px mono caps at 0.1em. Never filled.', 'Colour on the border and text, matched.'),
  row('Empty state', 'Italic Newsreader, centred, stating the actual shortfall &mdash; "ADRO and PTBA share 41 sessions; ninety are required."', 'One outlined button offering the concrete fix.'),
  row('Modal', 'A sheet, not a card: paper ground, 2px ink top rule, no radius, no shadow. Backdrop is paper at 82% with no blur.', 'Focus traps to the first field; Esc closes; the confirm button is solid ink.'),
])}

<h3 class="sub">Motion</h3>
${motion(
  ['Section rules draw in with <code>scaleX</code> from left, 400ms &mdash; lifted from your brand site.',
   'Hover ground change, 0ms. Instant, because paper does not fade.',
   'Route change: content replaces at once. No cross-fade.'],
  ['Figures. A number never counts up, never flashes, never slides.',
   'Charts on load. The line is drawn, not animated in.',
   'Anything ambient. No drifting mesh, no pulsing dot, no shimmer.'],
  `<p class="thesis" style="font-size:14px">Focus is a 2px ink-blue outline at 1px offset &mdash; the accent, so it never
   collides with gain/loss. Row focus and row hover look identical, so keyboard and mouse produce the same picture.
   <code>&#8984;K</code> opens the palette; <code>/</code> focuses filter; <code>g</code> then a letter jumps section.</p>`
)}</div>`;

/* ══════════════════════════════ B · TAPE ══════════════════════════════ */
const b = head('B', 'Tape', 'Terminal &middot; all-mono &middot; reverse-video', 'b-tape.html') + `
<p class="thesis">If it is going to be a terminal, <b>be a terminal</b> &mdash; not a web app wearing terminal costume.
The current build gestures at this (mono figures, dense tables, an amber accent) without committing; the commitment is
the entire point of this direction. Everything sits on a <b>7.2px character cell</b>, the width of one IBM Plex Mono
glyph at 12px, so columns align by construction rather than by eyeballed padding. There are <b>no cards</b>: separation
is full-bleed 1px rules and column gutters, exactly as a TUI would do it. Selection is <b>reverse video</b> &mdash; a
solid fill with the ground colour punched out of it &mdash; not a tinted background. A tmux-style status line is pinned
to the bottom carrying position count, breach count and NAV.</p>

<div class="stances">
  <div><div class="l">Optimises for</div><p>Information per pixel and muscle memory. It fits identical content in 1,388px against Ledger's 1,945px &mdash; 29% less scrolling.</p></div>
  <div><div class="l">For whom</div><p>An operator who lives on the keyboard, watches a live tape, and wants the machine to stop apologising for being a machine.</p></div>
  <div><div class="l">Rejects</div><p>Cards, radius, shadow, easing curves, and the idea that a financial tool should be soothing.</p></div>
</div>

<h3 class="sub">Colour &mdash; dark (home)</h3>
<div class="swatches">
  ${sw('ground', '#080B10', 'cold blue-black')}${sw('ground-2', '#0C1118', 'hover only')}${sw('fg', '#D9E1EA', '14.9:1')}
  ${sw('fg-2', '#93A2B1', '7.6:1')}${sw('fg-3', '#6C7B8A', '4.5:1 floor')}${sw('accent', '#57C9EA', 'ice &mdash; never green/red/amber')}
  ${sw('up', '#33D68C', '10.5:1')}${sw('down', '#FF5C52', '6.5:1')}${sw('caution', '#F2C14E', '11.7:1')}
</div>
<h3 class="sub">Colour &mdash; light (paper tape)</h3>
<div class="swatches">
  ${sw('ground', '#F2F1ED', '')}${sw('fg', '#0B0F14', '17:1')}${sw('fg-2', '#3B454F', '8.6:1')}
  ${sw('fg-3', '#5E6A76', '4.9:1')}${sw('accent', '#0D6E8C', '')}${sw('up', '#0F7A48', '')}${sw('down', '#B92B20', '')}
</div>
<p class="thesis" style="font-size:14px;margin-top:12px">The accent is deliberately <b>ice cyan</b>, a hue with no P&amp;L
meaning. That is the fix for the collision in the current build, where amber is simultaneously the brand accent and the
<code>warning</code> severity. Here green, red and amber mean exactly one thing each, always.</p>

<h3 class="sub">Typography</h3>
${table(['Role', 'Face &amp; size', 'Detail'], [
  row('Everything data', 'IBM Plex Mono 12/18', 'tnum + slashed zero. One face for figures, prose and nav.'),
  row('Chrome &amp; labels', 'Martian Mono 8.5 &middot; 600 &middot; 0.06em caps', 'Wide mono, used only for column heads, section rules and the wordmark.'),
  row('Page title', 'Martian Mono 14 &middot; 600', 'Uppercase.'),
  row('KPI figure', 'IBM Plex Mono 19 &middot; 500 &middot; &minus;0.02em', ''),
  row('Feed prose', 'IBM Plex Mono 11.5/17', 'The known cost: mono body text is tiring past a paragraph.'),
  row('Structure', 'Box-drawing glyphs &#9484; &#9472; &#9474; &#9500; &#9492;', 'Real characters doing real structural work, not an ASCII texture.'),
])}

<h3 class="sub">Density &amp; space</h3>
${table(['Token', 'Value', 'Note'], [
  row('Cell', '1ch = 7.2px (measured)', 'All horizontal padding and column widths are expressed in <code>ch</code>.'),
  row('Table row', '22px', 'The densest of the three; about 49 rows per 1080px.'),
  row('Line height', '18px flat', 'A fixed leading grid, like a terminal.'),
  row('Column widths', '<code>20ch 16ch 10ch 1fr 3ch</code>', 'Never px. Columns cannot drift out of alignment.'),
  row('Section gap', '16px', ''),
])}

<h3 class="sub">Border, radius, elevation</h3>
${table(['Property', 'Value', 'Rule'], [
  row('Radius', '0 &mdash; everywhere', 'Same as Ledger, for the opposite reason: a cell grid has no curves.'),
  row('Elevation', 'None, and no panel backgrounds either', 'Only two grounds exist: base and hover.'),
  row('Rules', '1px <code>#18212B</code>, section 1px <code>#27333F</code>', 'Two weights, no more.'),
  row('Reverse video', 'Fill = fg or a semantic hue; text = ground', 'The single strongest emphasis available. Used for active nav, selected row, active toggle, status segments.'),
])}

<h3 class="sub">Component vocabulary</h3>
${table(['Component', 'Form', 'Behaviour'], [
  row('Stat tile', 'A labelled cell in a six-column strip split by 1px rules. No box.', 'Hover paints ground-2.'),
  row('Table row', '22px. Every figure carries an explicit sign and a &#9650;/&#9660; glyph &mdash; sign, glyph and colour all agree.', 'Selected row inverts completely; the semantic colours invert with it so the row stays one object.'),
  row('Chart', 'NAV in <code>fg</code>, benchmarks dimmer and dashed/dotted. 1px gridlines.', 'NAV is deliberately <em>not</em> green &mdash; series identity and P&amp;L direction must not share a channel.'),
  row('Nav item', '<code>&#9474; 1 COMMAND CENTER</code> &mdash; a rule glyph, a shortcut key, the label.', 'Active is full reverse video. The shortcut is the affordance, always visible.'),
  row('Badge / pill', 'Reverse-video block, 0 radius: <span style="background:#FF5C52;color:#080B10;padding:0 4px;font-family:var(--f-m);font-size:11px">BREACH</span>', 'Severity by fill, label always spelled out.'),
  row('Empty state', 'A box-drawn frame stating the shortfall in machine terms &mdash; <code>ADRO&#8596;PTBA 41/90 sessions</code>.', 'One outlined button.'),
  row('Modal', 'A full-width band, not a floating box: 1px rule top and bottom, ground fill, no backdrop blur.', 'Esc closes, Enter confirms, Tab cycles. Never traps the mouse.'),
])}

<h3 class="sub">Motion</h3>
${motion(
  ['Tick flash on a changed value: 1 frame to a 34% fill, then out. Stepped, not eased &mdash; the Bloomberg idiom.',
   'Cursor blink on the command line, 1.1s steps(2).',
   'Ticker tape translate, linear, pausable on hover.'],
  ['Everything else. There are no transition curves in this direction at all.',
   'Hover states, which are instant.',
   'Route changes, panel opens, chart draws.'],
  `<p class="thesis" style="font-size:14px">Every nav item shows its shortcut permanently in the rail
   (<code>1</code>&ndash;<code>6</code>, <code>i x c</code>, <code>w a n e g</code>). Focus is a reverse-video block,
   identical to selection, so there is one visual language for "here". <code>&#8984;K</code> palette,
   <code>j/k</code> row movement, <code>Enter</code> to open. The status line is a permanent readout of mode and state.</p>`
)}</div>`;

/* ═══════════════════════════ C · INSTRUMENT ═══════════════════════════ */
const c = head('C', 'Instrument', 'Glass cockpit &middot; calibrated &middot; Swiss', 'c-instrument.html') + `
<p class="thesis">A cockpit in the literal sense: an <b>instrument panel</b> where every reading has a fixed address and
a calibrated scale behind it. Its one structural idea is that a number alone is not information &mdash; a number
<em>against its range</em> is. So every figure sits on a band showing where it falls between its limits, with a
<b>cyan tick for the benchmark</b> and a <b>magenta tick for your target</b>. The colour system is lifted wholesale from
aviation glass cockpits, where it has been refined for exactly this problem: <b>white = actual, cyan = reference,
magenta = selected/target, green = in tolerance, amber = caution, red = warning</b>. That rule dissolves the accent
collision in the current build, because the accent stops being a brand decision and becomes a semantic one. It also
rejects monospace for figures &mdash; a grotesque with true tabular lining figures is the Swiss instrument answer, not
the terminal one.</p>

<div class="stances">
  <div><div class="l">Optimises for</div><p>Glanceability and drift. Answering "how far is this from where I said it should be" without arithmetic.</p></div>
  <div><div class="l">For whom</div><p>A CIO running a concentrated book against explicit target weights, sector limits and a drawdown floor.</p></div>
  <div><div class="l">Rejects</div><p>Both nostalgias &mdash; paper and terminal. Decorative colour of any kind. Monospace as a signal of seriousness.</p></div>
</div>

<h3 class="sub">Colour &mdash; dark (home)</h3>
<div class="swatches">
  ${sw('ground', '#111316', 'true neutral graphite')}${sw('well', '#171A1E', 'panel')}${sw('raised', '#1E2228', 'hover')}
  ${sw('fg', '#E8EBEE', 'actual &middot; 15.6:1')}${sw('fg-2', '#9BA4AD', '7.4:1')}${sw('fg-3', '#777F88', '4.6:1')}
  ${sw('ref', '#4FC3E8', 'benchmark &middot; 9.1:1')}${sw('tgt', '#F05FB4', 'target &middot; 6.2:1')}
  ${sw('ok', '#3FD182', 'in tolerance')}${sw('caution', '#F5A524', 'caution')}${sw('warn', '#FF4D4D', 'warning')}
</div>
<h3 class="sub">Colour &mdash; light (day mode)</h3>
<div class="swatches">
  ${sw('ground', '#E6E9EC', '')}${sw('well', '#F3F5F7', '')}${sw('raised', '#FFFFFF', '')}
  ${sw('fg', '#14171A', '14.8:1')}${sw('fg-2', '#4B545C', '6.3:1')}${sw('fg-3', '#616971', '4.6:1')}
  ${sw('ref', '#0A6E93', '')}${sw('tgt', '#B01E75', '')}${sw('ok', '#0E7845', '')}${sw('caution', '#8A5A00', '')}${sw('warn', '#C22A22', '')}
</div>
<p class="thesis" style="font-size:14px;margin-top:12px">This is the only direction where <b>light mode has a real
job</b>: a bright-room day mode for a screen used near a window, which is why the ground is a true neutral rather than
a tinted one. The semantic hues darken rather than invert, so the code holds in both.</p>

<h3 class="sub">Typography</h3>
${table(['Role', 'Face &amp; size', 'Detail'], [
  row('Everything', 'Archivo 12.5/1.4', 'One family for UI, prose <em>and</em> figures.'),
  row('Figures', 'Archivo with <code>tabular-nums lining-nums</code>', 'The direction\'s clearest opinion: numbers do not need to be monospaced, they need to be tabular. Verified active in the render.'),
  row('Page title', 'Archivo 20 &middot; 600 &middot; &minus;0.02em', ''),
  row('KPI figure', 'Archivo 21 &middot; 600 &middot; &minus;0.03em', 'Unit suffix at 11px/500 in fg-3.'),
  row('Labels', 'Archivo 9 &middot; 600 &middot; 0.11em caps', ''),
  row('Machine metadata', 'Azeret Mono 9', 'Only for timestamps, scale endpoints, sync state &mdash; things a machine wrote.'),
])}

<h3 class="sub">Density &amp; space</h3>
${table(['Token', 'Value', 'Note'], [
  row('Base', '12.5px / 1.4', ''),
  row('Table row', '28px', 'About 38 rows per 1080px &mdash; between Ledger and Tape.'),
  row('Grid', '4 / 8 / 12 / 18 / 20 &mdash; a true 4pt scale', 'Unlike the other two, this one is on a mechanical grid on purpose.'),
  row('Panel gap', '8px', 'Tight. Panels read as adjacent instruments, not floating cards.'),
  row('Fixed zones', 'The KPI strip is always six columns in the same order', 'A reading never moves. Position is part of how you identify it.'),
])}

<h3 class="sub">Border, radius, elevation</h3>
${table(['Property', 'Value', 'Rule'], [
  row('Radius', '4px &mdash; the only direction with any', 'Machined bezel, not a soft card.'),
  row('Elevation', '<code>inset 0 1px 0 rgba(255,255,255,.05)</code>', 'A top-edge highlight, as on a milled panel. No drop shadow anywhere &mdash; instruments are set into the surface, not floating above it.'),
  row('Border', '1px at 7.5% white', 'Panels are defined by fill + edge highlight; the border is nearly subliminal.'),
  row('Selection', '11% magenta wash + a 2px magenta inset bar', 'Magenta means selected, consistently, everywhere.'),
])}

<h3 class="sub">Component vocabulary</h3>
${table(['Component', 'Form', 'Behaviour'], [
  row('Stat tile', 'The signature. Label, figure, delta, then a 5px calibrated band: fill to current, cyan tick at benchmark, magenta tick at target, endpoints labelled in Azeret.', 'The band fill takes a semantic colour when the reading leaves tolerance &mdash; gross exposure at 93.8% against a 90% cap fills amber.'),
  row('Table row', '28px. Adds a <b>Weight vs target</b> column: a mini-band per position with a magenta target tick, plus a signed drift figure.', 'Drift beyond band turns the figure amber. Selected row washes magenta with an inset bar.'),
  row('Chart', 'NAV white, JCI cyan, S&amp;P dimmed cyan, and a magenta dashed <b>plan line</b>. The drawdown floor is drawn as a magenta dashed limit.', 'Series colour is semantic, not categorical &mdash; you can name what a line is from its hue alone.'),
  row('Nav item', '4px radius, raised fill when active, plus a 2px magenta left bar. Warning counts ride as a red pill on the right.', 'Magenta = "this is where you are", consistent with target/selected everywhere else.'),
  row('Badge / pill', '3px radius, 12% tinted fill, 45% border, uppercase 9.5px/600 &mdash; <span style="border:1px solid rgba(255,77,77,.45);background:rgba(255,77,77,.12);color:#C22A22;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:.08em">BREACH</span>', 'Severity words, never bare colour.'),
  row('Empty state', 'Outline glyph, the shortfall in plain language, one filled button.', 'Says the actual numbers: 41 of 90 sessions.'),
  row('Modal', 'A well raised to <code>--raised</code> with the same 4px radius and inset top highlight, on a 70% ground scrim. Still no drop shadow.', 'Focus traps; Esc closes; the primary button is magenta because it is the selected action.'),
])}

<h3 class="sub">Motion</h3>
${motion(
  ['Band fills and ticks, on data change: 220ms critically-damped, no overshoot. An instrument needle settles, it does not bounce.',
   'Hover raise, 120ms ease-out.',
   'Panel expand/collapse, 180ms.'],
  ['<b>The number itself. Ever.</b> The pointer moves, the figure cuts. This is the direction\'s single hardest rule.',
   'The live LED. It is a state, not a heartbeat &mdash; it does not pulse.',
   'Anything on route change, so a reading never appears to be in motion when it is just new.'],
  `<p class="thesis" style="font-size:14px">Focus is a 2px cyan outline &mdash; the reference colour, deliberately
   distinct from magenta selection, so "where the keyboard is" and "what is selected" are never confused. That
   distinction is the whole reason the aviation code separates them. <code>&#8984;K</code> palette,
   <code>j/k</code> rows, <code>[</code> <code>]</code> to change timeframe, <code>t</code> toggles target bands off
   for a clean read.</p>`
)}</div>`;

export default { a, b, c };
