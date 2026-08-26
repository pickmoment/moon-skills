# API and spec-level options

## Quickstart

```js
const VT = require('<skill>/assets/visualthink.js');   // <skill> = this skill's folder

const spec = { title: '제목', blocks: [ /* ... */ ] };

const check = VT.validate(spec);        // ALWAYS validate first
if (!check.ok) throw new Error(check.errors.join('\n'));

fs.writeFileSync('out.html', VT.toHTML(spec));   // standalone page
// or: VT.render(spec) -> SVG string to embed in an existing document
```

Browser: `<script src="assets/visualthink.js"></script>` then `VT.mount('#el', spec)`.

---

## API

| Call | Returns |
|---|---|
| `VT.validate(spec)` | `{ ok, errors[], warnings[] }` — errors block rendering |
| `VT.render(spec, opts?)` | SVG string |
| `VT.toHTML(spec, opts?)` | complete standalone HTML document |
| `VT.toPresentation(spec, opts?)` | standalone HTML that presents the page (see below) |
| `VT.mount(target, spec)` | renders into a DOM element (browser) |
| `VT.toDataURI(spec)` | `data:image/svg+xml,…` for an `<img src>` |
| `VT.defineBlock(name, fn)` | register a custom block type |
| `VT.blocks` / `.icons` / `.themes` / `.colors` | available names |

`opts` overrides any spec-level option: `VT.render(spec, { theme: 'flat' })`.

Rendering is **deterministic** — the same spec and seed always produce byte-identical
SVG, so output is safe to commit and diff.

---

## Spec-level options

```jsonc
{
  "title": "…", "subtitle": "…",     // sugar for a leading title block
  "theme": "sketch",                 // sketch · flat · editorial · bold
  "width": 1100,                     // canvas width in px; height is automatic
  "padding": 44,
  "gap": 34,                         // vertical space between blocks
  "density": "standard",             // brief · standard · detailed (validate only)
  "seed": "any-string",              // changes the hand-drawn jitter
  "paper": false,                    // grid · dot · ruled · true (grain) · false
  "background": true,
  "blocks": [ /* … */ ]
}
```

`gapAfter` on any block overrides `gap` after that one block.

---

## Presentation mode

`VT.toPresentation(spec)` returns a standalone HTML file that presents the same
page. **It is not a slide deck** — the page stays one continuous canvas and the
camera flies from block to block, zooming each to fill the screen. The audience
keeps seeing where a part sits inside the whole.

```js
fs.writeFileSync('deck.html', VT.toPresentation(spec, { theme: 'sketch' }));
```

Every block is a stop, in order, with the whole page as the first and last one.
`divider` and `spacer` are skipped. To make several blocks share one stop, give
them the same `step`:

```jsonc
{ "type": "stats", "step": 3, "items": [ ... ] },
{ "type": "list",  "step": 3, "items": [ ... ] }   // visited together
```

Controls: `←` `→` `Space` move · `O` overview grid · `F` fullscreen ·
`0-9` jump · `Home`/`End` · click, right-click, swipe · `#3` in the URL deep-links.

| option | default | |
|---|---|---|
| `dim` | `true` | fade blocks other than the current one |
| `maxZoom` | `2.4` | cap so a small block does not fill the screen absurdly |
| `pad` | `46` | breathing room around the focused block |
| `transition` | `760` | camera flight time in ms |
| `endOverview` | `true` | return to the whole page as the final stop |
| `hint` | `true` | show the title in the corner throughout |

**Write the spec for reading first.** A page that works as a single scrollable
diagram presents well; one built only for presenting usually reads badly on
paper. Same spec, both outputs.
