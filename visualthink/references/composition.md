# Composition — choosing blocks and sizing a page

What block a piece of content wants, how much belongs on one page, and the
mistakes that show up most. Field-level facts live in `blocks.md`.

## The one rule

**Pick the block that matches the *shape of the idea*, not the shape of your text.**
A list of four things is not automatically a `list`. If they happen in order it is
`flow` or `steps`; if they are alternatives it is `compare`; if they are facets of
one concept it is `mindmap`.

---

## Block selection guide

| The content is… | Use | Why |
|---|---|---|
| The headline of the whole page | `title` | Once, at the top |
| A single key message to land | `callout` | Bubble/sticky emphasis |
| A sequence, A → B → C | `flow` | Horizontal, auto-wraps |
| A procedure with ordered stages | `steps` | Numbered vertical rail |
| A repeating loop with no end | `cycle` | Ring with arrows |
| Events on a date axis | `timeline` | Horizontal axis |
| One concept broken into facets | `mindmap` | Centre + branches |
| Two or three positions contrasted | `compare` | Side-by-side columns |
| Peer items with no order | `grid` | Uniform card grid |
| Items scored on two dimensions | `matrix` | 2×2 quadrants |
| A hierarchy or a funnel | `pyramid` | Stacked layers |
| Headline numbers | `stats` | Big figures |
| Points to remember | `list` | Icon/numbered bullets |
| A quotation | `quote` | Pull quote |
| People, roles or stakeholders | `actors` | Stick figures, optionally speaking |
| One person making a statement | `scene` | Figure beside a speech bubble |
| A visual break | `divider`, `spacer` | Pacing |

---

## How much goes on the page

Pick `density` from the content, not from a preference or a target count. Work
out every point that has to survive first, then label the result: `brief` for
something that converges on one claim, `standard` for one topic on one page,
`detailed` for a subject with several sections. Never pad to fill a band or drop
a needed point to fit one — when there is more than a page holds, raise the
altitude (group siblings under a parent idea) or split the page. Set it in the
spec so `validate()` can hold you to it:

| `density` | blocks | label | note | callout/quote | for |
|---|---|---|---|---|---|
| `brief` | 3–5 | ≤14자 | ≤24자 | ≤60자 | 한 가지 논점, 슬랙·이슈에 붙일 것 |
| `standard` | 4–8 | ≤20자 | ≤40자 | ≤110자 | 기본값. 한 주제를 한 장으로 |
| `detailed` | 8–14 | ≤26자 | ≤56자 | ≤180자 | 브리핑 자료, 여러 절이 있는 주제 |

These are **warnings, not errors** — long text shrinks to fit rather than
overflowing, so nothing breaks. But shrunken text is unreadable at the back of a
room, which is why the budgets exist. With no `density` set only an absolute
ceiling (16 blocks) is checked.

---

## Composition guidance

The page holds what the content needs — see *How much goes on the page* above.
What matters here is the arrangement, not the count. When a page grows past what
one screen reads comfortably, that is a signal to raise the altitude or split it,
never to delete a point that belongs.

A reliable pattern:

1. `title` — what this is about
2. `callout` — the one-line answer
3. `stats` — the numbers that anchor it
4. one *structural* block (`mindmap` / `compare` / `matrix`) — the shape of the problem
5. one *sequential* block (`steps` / `timeline` / `flow`) — how it unfolds
6. `list` — what to remember

Vary the block types. Six `grid` blocks in a row is a wall, not a diagram.

**Text length matters.** These are diagram labels, not prose. The budgets above
are per-density; at `standard` that means ≤20자 labels and ≤40자 notes. Longer
text is wrapped and then shrunk to fit — it will not overflow, but it will get
small. If you need a paragraph, use `callout`, not a card.

**Item counts per block** — these are layout limits, not a budget on the page.
Past them a block wraps and shrinks rather than reading cleanly, so split into
two blocks instead of cutting content: `flow` 3–8 · `steps` 3–6 · `cycle` 3–6 · `timeline` 3–6
· `mindmap` 4–8 branches · `compare` 2–3 columns × 3–5 items · `grid` 3–8
· `matrix` exactly 4 · `pyramid` 3–5 · `stats` 2–4 · `list` 3–7 · `actors` 2–5

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Writing coordinates or sizes | You cannot. Layout is automatic by design. |
| Rewriting a spec to suit a theme | Themes are interchangeable. Change `theme` only. |
| Putting a paragraph in a card's `text` | Move it to `note`, or use a `callout`. |
| Using `list` for everything | Match the block to the idea's shape (table above). |
| 15 items in one `flow` | Split into two blocks, or use `grid`. |
| Colouring every item differently | Let it auto-assign; set `color` only for meaning. |
| `matrix` with 3 quadrants | Always supply 4, in TL/TR/BL/BR order. |
| Skipping `validate()` | Errors become blank or broken regions. Always check. |
| Ignoring density warnings | Text that shrinks to fit is text nobody reads. Cut words. |
| Marking every item | Emphasis works by contrast. One or two `mark`s per page. |
| Giving every actor an `fx` | Effects are reactions, not decoration. One or two per page. |
| Tilting a grid or sequence | Tilt loose notes only; a crooked grid looks broken. |
| Decorating a `flat`/`editorial` page | Those themes carry character through type. |
