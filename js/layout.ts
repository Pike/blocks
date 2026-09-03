import type { Player } from "./player";
import { elements } from "./elements";
import state from "./state";
import { createStone } from "./model";

const s = new CSSStyleSheet();
s.replaceSync(`
:host {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.left {
  flex: 1;
  display: flex;
  flex-flow: column;
}
::slotted(#table) {
  flex: 1;
}
::slotted(g-pool) {
  position: fixed;
  bottom: 0;
  right: 0;
}
`);

export class Layout extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
        <div class="left">
            <slot name="table"></slot>
            <slot name="board"></slot>
        </div>
        <div class="right">
            <slot name="players"></slot>
        </div>
        <slot name="pool"></slot>
        <slot name="menu"></slot>
        `;
    shadow.adoptedStyleSheets = [s];
    this.innerHTML = `
        <g-board slot="table" id="table" ondrop></g-board>
        <g-pool slot="pool"></g-pool>
        <g-board slot="board" id="board" drop></g-board>
        <div slot="players">
        </div>
        <sl-dropdown id="menu" slot="menu">
            <sl-icon-button name="gear" label="Settings" slot="trigger" style="font-size: 2rem;"></sl-icon-button>
            <sl-menu>
                <sl-menu-item id="settings">Einstellungen</sl-menu-item>
                <sl-menu-item id="startGame">Spiel starten</sl-menu-item>
            </sl-menu>
        </sl-dropdown>
        `;
  }

  get players(): NodeListOf<Player> {
    return this.querySelectorAll("g-player, g-remote") as NodeListOf<Player>;
  }

  mapPlayers<T>(fun: (player: Player) => T): T[] {
    return Array.from(this.players).map(fun);
  }

  addPlayer(player: Player): void {
    const container = this.querySelector("[slot=players]");
    if (container) {
      container.append(player);
    }
  }

  arrangePlayers(player_ids: string[]): void {
    const container = this.querySelector("[slot=players]");
    if (!container) return;

    while (player_ids.length) {
      const player_id = player_ids.pop();
      if (!player_id) continue;

      for (const player of container.children) {
        const playerEl = player as Player;
        if (playerEl.peer === player_id) {
          container.append(player);
          break;
        }
      }
    }
  }

  markActive(peer: string): void {
    const container = this.querySelector("[slot=players]");
    if (!container) return;

    for (const player of container.querySelectorAll(".active")) {
      player.classList.remove("active");
    }
    for (const player of container.children) {
      const playerEl = player as Player;
      if (playerEl.peer === peer) {
        player.classList.add("active");
      }
    }
  }

  nextPlayer(): void {
    const { board, table } = elements;
    const { pool } = state;
    const current = Array.from(this.players).find((player) =>
      player.classList.contains("active"),
    );
    if (!current || !board || !table) {
      // We're not active
      return;
    }
    if (board.empty) {
      this.declareWinner(current);
      return;
    }
    const next = (current.nextElementSibling ||
      current.parentElement?.firstElementChild) as Player | undefined;
    if (current.needsStone) {
      const poolToken = pool.pop();
      if (poolToken) {
        board.appendStone(createStone(poolToken));
      }
    }
    current.deactivate();
    if (next) {
      next.activate(pool, table.data());
    }
  }

  private async declareWinner(winner: Player): Promise<void> {
    await Promise.all(
      Array.from(this.players).map((player) =>
        player.winner(winner === player ? undefined : winner.name || undefined),
      ),
    );
  }
}

customElements.define("g-layout", Layout);
