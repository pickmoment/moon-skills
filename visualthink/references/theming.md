# Theming and decoration

The owner document for what each theme looks like and when decoration is
appropriate. **The spec never changes to suit a theme** — pass `theme` and
nothing else.

## Themes

| theme | look | use when |
|---|---|---|
| `sketch` | hand-drawn on warm paper (default) | learning material, idea notes, explaining |
| `flat` | clean vector, soft shadows | reports, slides, anything official |
| `editorial` | serif, no boxes, hairline rules | long-form summaries, essays, magazine tone |
| `bold` | oversized sans, square corners, thick strokes | posters, campaign cards, talk slides |

The hand-drawn themes set headings in Jua and body text in Gamja Flower, chosen
for Korean legibility at small sizes. You do not pick fonts in a spec; the theme
does. To override, pass an inline theme (see README).

`editorial` and `bold` are **type-led**: they change more than colour. `editorial`
removes card outlines entirely and lets a serif headline plus a rule carry the
hierarchy; `bold` enlarges headings and squares off every corner. Blocks adapt
automatically — a `callout` becomes a ruled aside under `editorial`, and
`compare` drops its column boxes for accent rules.

Because these two lean on type, they reward **shorter labels**. If a spec looks
crowded in `editorial`, cut words rather than widening the canvas.

---

## Decoration

Three optional layers exist for emphasis and texture:

```jsonc
{ "text": "ISR 자산", "mark": "circle", "pin": "tape", "tilt": true }
```

- **`mark`** — annotation drawn *around* the card, like a pen stroke added later:
  `circle` (lassoed) · `box` · `burst` (radiating lines) · `star` · `squiggle`
  (wavy underline) · `bang` (exclamation) · `arrow` (pointer from above)
- **`pin`** — `tape` · `pin` · `clip`, as if fastened to the page
- **`tilt`** — `true` for a random 1–2°, or an explicit number of degrees

And at spec level, a page surface:

```jsonc
{ "paper": "grid" }   // grid · dot · ruled · true (grain) · false
```

**Restraint is the whole game.** These read as emphasis precisely because they
are rare. Concretely:

- **At most one or two `mark`s per page**, on the item that actually matters.
  Marking everything marks nothing.
- `tilt` and `pin` suit `sticky` cards and loose notes. Do not tilt a `steps`
  sequence or a `matrix` — a wonky grid reads as broken, not casual.
- `paper` is a background; pick one and leave it. `grid` and `dot` suit working
  notes, `ruled` suits written ones.
- Decoration belongs to the `sketch` theme. On `flat`, `editorial` and `bold`
  it fights the design — those themes get their character from type and rules.
