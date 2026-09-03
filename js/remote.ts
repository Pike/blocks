import { Peer, type DataConnection } from "peerjs";
import { RemotePlayer, type Player } from "./player";
import { elements } from "./elements";
import { COMMANDS } from "./commands";
import { dispatchCommand, type CommandContext } from "./game-commands";

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
    const peer = await this.connectPeer(host_id);
    this.connections.set(peer.peer, peer);
    this.host = peer;
    return this.rpc(peer, COMMANDS.JOIN_GAME, {
      id: this.me.id,
      name: this.myname,
    });
  }

  newConnection(dataConnection: DataConnection) {
    this.connections.set(dataConnection.peer, dataConnection);
    dataConnection.on("data", (data) => this.onData(dataConnection, data));
  }

  async connectPeer(id: string): Promise<DataConnection> {
    const peer = this.me.connect(id, {
      label: "game-data",
    });
    peer.on("data", (data) => this.onData(peer, data));
    await new Promise<void>((resolve) => {
      peer.on("open", () => resolve());
    });
    return peer;
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
    // Exactly one non-remote `g-player` is expected to exist per tab.
    const localPlayer = document.querySelector("g-player") as Player;
    const ctx: CommandContext = {
      sender,
      localPlayer,
      game,
      table,
      remote: this,
      createRemotePlayer: (connection, name) =>
        new RemotePlayer(connection, name, this),
    };
    const responseBody = await dispatchCommand(method, body, ctx);
    console.log("sending response", responseBody);
    sender.send({
      body: responseBody,
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
