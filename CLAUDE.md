# CLAUDE.md

## Docs

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary (Tile, Rack, Table, Set, Group, Run, Joker, Deck, Pool, Game, Player). Read before touching gameplay logic or naming anything new.
- [`docs/rules.md`](./docs/rules.md) — the official Rummikub rules. The code is not fully caught up to this vocabulary or ruleset yet (see `CONTEXT.md`'s `_Avoid_` notes and the gaps called out per term, e.g. no Set validation, no Initial Meld enforcement).
- [`docs/remote.md`](./docs/remote.md) — the WebRTC/PeerJS RPC protocol used for multiplayer.

## Commands

See `package.json` scripts (`dev`, `build`, `preview`, `test`). One thing worth knowing explicitly: `npm run tsc` is the typecheck command, and `build` does **not** run it — Vite doesn't type-check. Run `npm run tsc` explicitly before considering a change done.

## Architecture

Vanilla Web Components (`customElements.define`, shadow DOM, `adoptedStyleSheets`).

`js/` module map:

- `model.ts` — `Stone`/`Deck` domain model (pre-`Tile`-rename; see `CONTEXT.md`)
- `board.ts` — the `Board`, `Group`, `Stone`, `Pool` custom elements and drag-drop wiring
- `drop-placement.ts` — pure drop-placement/split logic extracted out of `board.ts`, unit-tested without a DOM
- `player.ts` — `Player` (local) and `RemotePlayer` (RPC-proxied) elements
- `layout.ts` — the `g-layout` app shell hosting one Game
- `elements.ts` — typed DOM lookups (`board`, `table`, `game`) shared across modules
- `state.ts` — the `Pool` singleton
- `remote.ts` — PeerJS transport, connection setup, RPC send/dispatch
- `commands.ts` — RPC command name constants
- `game-commands.ts` — RPC command handlers (the receiving side of `remote.ts`'s dispatch)
- `dialogs.ts` — modal dialog custom element
- `main.ts` — boot sequence, dealing, menu wiring

## Conventions

Prefer extracting pure functions for new game logic (see `drop-placement.ts`) over adding it inline to custom element classes. Keeps logic unit-testable without a browser/DOM.
