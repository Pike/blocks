import { elements } from "./elements";
import state from "./state";

interface DataConnection {
  peer: string;
}

interface Remote {
  rpc(connection: DataConnection, method: string, data?: any): Promise<any>;
}

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
  private preBoard_: string | null = null;
  protected remote: Remote;

  id: string;

  constructor(name: string, remoteInstance: Remote, id?: string) {
    super();
    this.remote = remoteInstance;
    this.preBoard_ = null;
    this.id = id || "";
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [player_sheet];
    shadow.innerHTML = `<span><slot></slot></span>`;
    if (name) {
      this.append(name);
    }
  }

  get name(): string | null {
    return this.textContent;
  }

  get peer(): string {
    return this.id;
  }

  async arrangePlayers(player_ids: string[]): Promise<void> {
    const { game } = elements;
    game.arrangePlayers(player_ids);
  }

  async deal(pool: string[]): Promise<string[]> {
    const { board, table } = elements;
    console.log("deal", pool);
    // Convert stones to strings for drawing
    const boardStones = pool.splice(0, 14);
    board.drawGame(boardStones);
    table.drawGame([]);
    this.deactivate();
    return pool;
  }

  async activate(pool_: string[], table_data: any[]): Promise<void[]> {
    const { game, board, table } = elements;
    state.setPool(pool_);
    table.drawGame(table_data);
    table.enableDrop();
    this.preBoard_ = board.data().join("").split("").sort().join("");
    return Promise.all(
      game.mapPlayers((player: any) => player.markActive(this.peer)),
    );
  }

  async markActive(peer: string): Promise<void> {
    const { game } = elements;
    game.markActive(peer);
  }

  get needsStone(): boolean {
    const { board } = elements;
    return this.preBoard_ === board.data().join("").split("").sort().join("");
  }

  deactivate(): void {
    const { table } = elements;
    table.disableDrop();
    this.classList.remove("active");
    this.preBoard_ = null;
  }

  /**
   * New player joined this game.
   *
   * We need to call (or delegate) `connect players`
   */
  async addPlayer(remote_player: DataConnection): Promise<void> {
    const resp = await this.remote.rpc(remote_player, "connect players", {
      name: this.name,
    });
    const player = new RemotePlayer(remote_player, resp.name, this.remote);
    const { game } = elements;
    game.addPlayer(player);
  }

  async showTable(_table_data: any[]): Promise<void> {
    // Base implementation does nothing
    return;
  }

  async winner(winner?: string): Promise<any> {
    if (!winner) {
      winner = "You";
    }
    const dialogs = await import("./dialogs");
    return dialogs.winner(winner);
  }
}

export class RemotePlayer extends Player {
  private peerConnection: DataConnection;

  constructor(peer: DataConnection, name: string, remoteInstance: Remote) {
    super(name, remoteInstance);
    this.peerConnection = peer;
  }

  get peer(): string {
    return this.peerConnection.peer;
  }

  /**
   * New player joined this game.
   *
   * We need to call `add player` to delegate `connect players`
   */
  async addPlayer(remote_player: DataConnection): Promise<void> {
    await this.remote.rpc(this.peerConnection, "add player", {
      id: remote_player.peer,
    });
  }

  async arrangePlayers(player_ids: string[]): Promise<any> {
    return this.remote.rpc(this.peerConnection, "arrange players", player_ids);
  }

  async deal(pool: string[]): Promise<any> {
    const rv = await this.remote.rpc(this.peerConnection, "deal", pool);
    if (rv.error) {
      throw new Error(rv.error);
    }
    return rv;
  }

  async activate(pool: string[], table_data: any[]): Promise<any> {
    return this.remote.rpc(this.peerConnection, "activate", {
      pool,
      table_data,
    });
  }

  async markActive(peer: string): Promise<any> {
    return this.remote.rpc(this.peerConnection, "mark active", peer);
  }

  async showTable(table_data: any[]): Promise<any> {
    return this.remote.rpc(this.peerConnection, "show table", table_data);
  }

  async winner(winner: string): Promise<any> {
    return this.remote.rpc(this.peerConnection, "winner", winner);
  }
}

customElements.define("g-player", Player);
customElements.define("g-remote", RemotePlayer);
