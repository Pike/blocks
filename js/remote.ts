import { Peer, type DataConnection } from "peerjs";
import { RemotePlayer, type Player } from "./player";
import { elements } from "./elements";

class Remote {
  me: Peer | null;
  myname: string | null;
  connections: Map<string, DataConnection>;
  host: DataConnection | null;
  waitingResponses: Map<string, { resolve: Function; reject: Function }>;
  constructor() {
    this.host = null;
    this.me = null;
    this.myname = null;
    this.connections = new Map();
    this.waitingResponses = new Map();
  }

  async beMyself(myself: string) {
    this.myname = myself;
    this.me = new Peer(`pike_github_io-blocks-${myself}`);
    this.me.on("connection", (dataConnection) =>
      this.newConnection(dataConnection),
    );
    return new Promise<string>((resolve) => {
      if (!this.me) {
        throw new Error("Peer instance is not initialized");
      }
      this.me.on("open", (id) => {
        resolve(id);
      });
    });
  }

  async connectToHostedGame(host: string) {
    const host_id = `pike_github_io-blocks-${host}`;
    const peer = this.me.connect(host_id, {
      label: "game-data",
    });
    this.connections.set(peer.peer, peer);
    this.host = peer;
    peer.on("data", (data) => this.onData(peer, data));
    await new Promise((resolve) => {
      peer.on("open", () => resolve(peer));
    });
    return this.rpc(peer, "join game", {
      id: this.me.id,
      name: this.myname,
    });
  }

  newConnection(dataConnection: DataConnection) {
    this.connections.set(dataConnection.peer, dataConnection);
    dataConnection.on("data", (data) => this.onData(dataConnection, data));
  }

  rpc(remote: DataConnection, method: string, body: any) {
    // Maybe be stricter on something unique?
    const msgId = String(Math.random());
    const type = "call";
    return new Promise((resolve, reject) => {
      this.waitingResponses.set(msgId, { resolve, reject });
      remote.send({
        type,
        method,
        body,
        msgId,
      });
    });
  }

  async onData(sender: DataConnection, data: any) {
    switch (data.type) {
      case "call":
        this.dispatchCall(sender, data);
        break;
      case "call response":
        this.handleResponse(sender, data);
    }
  }

  async dispatchCall(sender: DataConnection, data: any) {
    const type = "call response";
    const { method, body, msgId } = data;
    const { game, table } = elements;
    console.log("call", data);
    data = "ok";
    switch (method) {
      case "join game":
        for (const player of document.querySelectorAll<Player>(
          "g-remote, g-player",
        )) {
          player.addPlayer(sender);
        }
        break;
      case "add player":
        // connect to new peer, and `connect players`
        const peer = this.me.connect(body.id, {
          label: "game-data",
        });
        peer.on("data", (data) => this.onData(peer, data));
        await new Promise((resolve) => {
          peer.on("open", () => resolve(peer));
        });
        await this.rpc(peer, "connect players", {
          name: this.myname,
        });
        break;
      case "connect players":
        // Add remote player, let them know my name
        const player = new RemotePlayer(sender, body.name, this);
        game.addPlayer(player);
        data = { name: this.myname };
        break;
      case "arrange players":
        game.arrangePlayers(body);
        break;
      case "deal":
        data = await (document.querySelector("g-player") as Player).deal(body);
        break;
      case "activate":
        (document.querySelector("g-player") as Player).activate(
          body.pool,
          body.table_data,
        );
        break;
      case "mark active":
        await game.markActive(body);
        break;
      case "show table":
        table.drawGame(body);
        break;
      case "winner":
        data = (document.querySelector("g-player") as Player).winner(body);
        break;
    }
    console.log("sending response", data);
    sender.send({
      body: data,
      type,
      msgId,
    });
  }

  handleResponse(_sender: DataConnection, data: any) {
    const { body, msgId } = data;
    const entry = this.waitingResponses.get(msgId);
    if (!entry) {
      console.warn("No waiting response for msgId:", msgId);
      return;
    }
    const { resolve } = entry;
    this.waitingResponses.delete(msgId);
    console.log("response", data);
    resolve(body);
  }
}

export const remote = new Remote();
