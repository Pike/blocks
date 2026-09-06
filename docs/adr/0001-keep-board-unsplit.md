# Keep `Board` as a single class instead of splitting into Rack/Table

`Board`/`g-board` currently implements both the Rack and the Table (see `CONTEXT.md`). We mapped every method and call site to see whether a split was worth doing: the only role-specific members are `empty` and `appendTile` (Rack-only), and the only real behavioral fork was `Tile.maybeDrop()` in `js/board.ts` sniffing the bare `ondrop` HTML attribute to decide whether to broadcast a drop (`(board as any)?.ondrop`). Everything else — `drawGame`, `data`, `space`, `elems`, the `enableDrop`/`disableDrop` mechanism — is shared identically by both roles.

Given how little actually differs, we decided against introducing `Rack`/`Table` classes (a new custom element, plus updates to markup, CSS, types, and tests across `board.ts`, `elements.ts`, `layout.ts`, `style.css`, `game-commands.ts`) and instead fixed only the real smell: replaced the attribute-sniff with an explicit `board === elements.table` identity check, and dropped the now-unused `ondrop` attribute from the table's markup.

`Board` still implements both roles with no structural distinction — revisit this decision if a requirement forces one (e.g. Rack contents must not be visible to other players over RPC, or Set validation, which only applies to the Table).
