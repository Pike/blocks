# Blocks

A browser-based Rummikub implementation played over WebRTC. Canonical gameplay vocabulary follows the official Rummikub rules (`docs/rules.md`); the code has not fully caught up to this vocabulary yet, and known gaps are noted under each term.

## Language

**Tile**:
One of the 106 numbered, colored playing pieces (or a Joker) that players hold and play.

**Rack**:
A player's private collection of tiles, not visible to other players.
_Avoid_: Board (the code's `Board` class/`g-board` element currently implements both the Rack and the Table with no structural distinction between them — kept deliberately unsplit for now, see [ADR-0001](./docs/adr/0001-keep-board-unsplit.md))

**Table**:
The shared, publicly visible surface where played Sets are placed and manipulated by all players.

**Set**:
A valid, playable arrangement of tiles on the Table: either a Group or a Run. Not yet validated anywhere in the code.

**Group**:
A Set of three or four tiles of the same number in different colors.

**Run**:
A Set of three or more consecutive numbers, all in the same color. 1 is always the lowest number and cannot follow 13.

**Cluster**:
The code's current freeform arrangement of tiles dragged next to each other in the UI (the `Cluster` class/`g-cluster` element). Unlike a Set, a Cluster has no validity requirement — it does not have to be a legal Group or Run.

**Initial Meld**:
The rule that a player's first play must consist of tiles from their Rack totaling at least 30 points, and may not use tiles already on the Table. Not yet implemented in code.

**Joker**:
A wildcard tile that can stand in for any tile needed to complete a Set.

**Deck**:
The complete, freshly constructed collection of every Tile in a Game (2 Jokers plus 8 sets of 1-13 in four colors), before any Rack is filled.

**Pool**:
The undealt Tiles not on any Rack or the Table, drawn from when a player cannot or chooses not to play. What remains of the Deck after dealing.

**Game**:
A single playthrough, from deal to the moment a player empties their Rack. There is no concept of scoring or of multiple Games making up a Round.
_Avoid_: Layout (the code's `g-layout`/`Layout` element hosts a Game — the whole app shell — but isn't itself the concept of a Game)

**Player**:
A participant holding a Rack, taking turns, whose win condition is emptying their Rack.
