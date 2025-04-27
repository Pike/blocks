import {Peer} from "peerjs";
import { RemotePlayer} from "./player.js"
import { elements } from "./elements.js";

class Remote {
    constructor() {
        this.host = null;
        this.me = null;
        this.myname = null;
        this.player_ = null;
        this.connections = new Map();
        this.waitingResponses = new Map();
        this.Callback = class {
            constructor(resolve, reject) {
                this.resolve = resolve;
                this.reject = reject;
            }
        }
    }

    async beMyself(myself) {
        this.myname = myself;
        this.me = new Peer(`pike_github_io-blocks-${myself}`);
        this.me.on(
            "connection",
            (dataConnection) => this.newConnection(dataConnection)
        );
        return new Promise(resolve => {
            this.me.on("open", id => {
                this.connections.set(id, this.me);
                resolve(id);
            });
        });
    }

    async connectToHostedGame(host) {
        const host_id = `pike_github_io-blocks-${host}`;
        const peer = this.me.connect(host_id, {
            label: "game-data",
        });
        this.connections.set(peer.peer, peer);
        this.host = peer;
        peer.on("data", (data) => this.onData(peer, data));
        await new Promise(resolve => {
            peer.on("open", () => resolve(peer));
        });
        return this.rpc(peer, "join game", {
            id: this.me.id,
            name: this.myname,
        });
    }

    newConnection(dataConnection) {
        this.connections.set(dataConnection.peer, dataConnection);
        dataConnection.on("data", (data) => this.onData(dataConnection, data));
    }

    rpc(remote, method, body) {
        // Maybe be stricter on something unique?
        const msgId = String(Math.random());
        const type = "call";
        return new Promise((resolve, reject) => {
            this.waitingResponses.set(msgId, {resolve, reject});
            remote.send({
                type, method, body, msgId
            })
        });
    }

    async onData(sender, data) {
        switch (data.type) {
            case "call":
                this.dispatchCall(sender, data);
                break;
            case "call response":
                this.handleResponse(sender, data);
        }
    }

    async dispatchCall(sender, data) {
        const type = "call response";
        const {method, body, msgId} = data;
        const {game} = elements;
        console.log("call", data);
        data = "ok";
        switch (method) {
            case "join game":
                for (const player of document.querySelectorAll("g-remote, g-player")) {
                    player.addPlayer(sender);
                }
                break;
            case "add player":
                // connect to new peer, and `connect players`
                const peer = this.me.connect(body.id, {
                    label: "game-data",
                })
                peer.on("data", (data) => this.onData(peer, data));
                await new Promise((resolve, reject) => {
                    peer.on("open", () => resolve(peer));
                })
                await this.rpc(peer, "connect players", {
                    name: this.myname,
                })
                break;
            case "connect players":
                // Add remote player, let them know my name
                const player = new RemotePlayer(sender, body.name, this);
                game.addPlayer(player);
                data = {name: this.myname};
                break;
            case "arrange players":
                game.arrangePlayers(body);
                break;
            case "deal":
                data = await document.querySelector("g-player").deal(body);
                break;
            case "activate":
                await document.querySelector("g-player").activate(body.pool, body.table_data);
                break;
            case "mark active":
                await game.markActive(body);
                break;
            case "show table":
                table.drawGame(body);
                break;
            case "winner":
                data = await document.querySelector("g-player").winner(body);
                break;
        }
        sender.send({
            body: data,
            type, msgId,
        });
    }

    handleResponse(sender, data) {
        const {body, msgId} = data;
        const {resolve, reject} = this.waitingResponses.get(msgId);
        this.waitingResponses.delete(msgId);
        console.log("response", data)
        resolve(body);
    }
}

export const remote = new Remote();
