import { elements } from "./elements.js";
import state from "./state.js";

const player_sheet = new CSSStyleSheet();
player_sheet.replaceSync(`
:host {
  display: block;
  background-color: aqua;
  border-radius: 5px;
  border: 1px solid black;
  height: 12ex;
}
:host(.active) {
  border-width: 2px;
}
span {
  margin: 2px;
  float:right;
}
`);

export class Player extends HTMLElement {
  constructor(name, id) {
    super();
    this.preBoard_ = null;
    this.id = id;
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [player_sheet];
    shadow.innerHTML = `<span><slot></slot></span>`;
    if (name) {
      this.append(name);
    }
  }

  get name() {
    return this.textContent;
  }

  get peer() {
    return this.id;
  }

  async arrangePlayers(player_ids) {
    const { game } = elements;
    game.arrangePlayers(player_ids);
  }

  async deal(pool) {
    const { board, table } = elements;
    board.drawGame(pool.splice(0, 14));
    table.drawGame([]);
    this.deactivate();
    return pool;
  }

  async activate(pool_, table_data) {
    const { game, board, table } = elements;
    state.setPool(pool_);
    table.drawGame(table_data);
    table.enableDrop();
    this.preBoard_ = board.data().join("").split("").sort().join("");
    return Promise.all(
      game.mapPlayers((player) => player.markActive(this.peer)),
    );
  }

  async markActive(peer) {
    const { game } = elements;
    game.markActive(peer);
  }

  get needsStone() {
    const { game } = elements;
    return this.preBoard_ === board.data().join("").split("").sort().join("");
  }

  deactivate() {
    const { table } = elements;
    table.disableDrop();
    this.classList.remove("active");
    this.preBoard_ = null;
  }

  /**
   * New player joined this game.
   *
   * We need to call (or delegate) `connect players`
   * @param {dataConnection} remote_player
   * @param {Remote} remoteInstance
   */
  async addPlayer(remote_player, remoteInstance) {
    const resp = await remoteInstance.rpc(remote_player, "connect players", {
      name: this.name,
    });
    const player = new RemotePlayer(remote_player, resp.name, remoteInstance);
    game.addPlayer(player);
  }

  async showTable(table_data) {
    return;
  }

  async winner(winner) {
    if (!winner) {
      winner = "You";
    }
    const dialogs = await import("./dialogs.js");
    return dialogs.winner(winner);
  }
}

export class RemotePlayer extends Player {
  constructor(peer, name, remoteInstance) {
    super(name);
    this.peerConnection = peer;
    this.remote = remoteInstance;
  }

  get peer() {
    return this.peerConnection.peer;
  }

  /**
   * New player joined this game.
   *
   * We need to call `add player` to delegate `connect players`
   * @param {dataConnection} remote_player
   */
  async addPlayer(remote_player) {
    const resp = await this.remote.rpc(this.peerConnection, "add player", {
      id: remote_player.peer,
    });
  }

  async arrangePlayers(player_ids) {
    return this.remote.rpc(this.peerConnection, "arrange players", player_ids);
  }

  async deal(pool) {
    const rv = await this.remote.rpc(this.peerConnection, "deal", pool);
    if (rv.error) {
      throw new Error(rv.error);
    }
    return rv;
  }

  async activate(pool, table_data) {
    return this.remote.rpc(this.peerConnection, "activate", {
      pool,
      table_data,
    });
  }

  async markActive(peer) {
    return this.remote.rpc(this.peerConnection, "mark active", peer);
  }

  async showTable(table_data) {
    return this.remote.rpc(this.peerConnection, "show table", table_data);
  }

  async winner(winner) {
    return this.remote.rpc(this.peerConnection, "winner", winner);
  }
}

customElements.define("g-player", Player);
customElements.define("g-remote", RemotePlayer);
