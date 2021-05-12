// global pool, table;

export class Player extends HTMLElement {
    constructor(name) {
        super();
        this.preBoard_ = null;
        const shadow = this.attachShadow({mode: "open"});
        shadow.innerHTML = `
        <style>
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
        </style>
        <span><slot></slot></span>
        `
        if (name) {
            this.append(name);
        }
    }

    get name() {
        return this.textContent;
    }

    get peer() {
        return remote.me.id;
    }

    async arrangePlayers(player_ids) {
        game.arrangePlayers(player_ids);
    }

    async deal(pool) {
        board.drawGame(pool.splice(0, 14));
        table.drawGame([]);
        this.deactivate();
        return pool;
    }

    async activate(pool_, table_data) {
        pool = pool_;
        table.drawGame(table_data);
        table.enableDrop();
        this.preBoard_ = board.data().join("").split("").sort().join("");
        return Promise.all(game.mapPlayers((player) => player.markActive(this.peer)));
    }

    async markActive(peer) {
        game.markActive(peer);
    }

    get needsStone() {
        return this.preBoard_ === board.data().join("").split("").sort().join("");
    }

    deactivate() {
        table.disableDrop();
        this.classList.remove("active");
        this.preBoard_ = null;
    }

    /**
     * New player joined this game.
     *
     * We need to call (or delegate) `connect players`
     * @param {dataConnection} remote_player
     */
    async addPlayer(remote_player) {
        const resp = await remote.rpc(
            remote_player, "connect players", {
                name: this.name,
            }
        );
        const player = new RemotePlayer(remote_player, resp.name);
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
    constructor(peer, name) {
        super(name);
        this.peerConnection = peer;
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
        const resp = await remote.rpc(
            this.peerConnection, "add player", {
                id: remote_player.peer,
            }
        );
    }

    async arrangePlayers(player_ids) {
        return remote.rpc(
            this.peerConnection, "arrange players", player_ids,
        )
    }

    async deal(pool) {
        const rv = await remote.rpc(this.peerConnection, "deal", pool);
        if (rv.error) {
            throw new Error(rv.error);
        }
        return rv;
    }

    async activate(pool, table_data) {
        return remote.rpc(
            this.peerConnection, "activate", {
                pool, table_data
            }
        )
    }

    async markActive(peer) {
        return remote.rpc(
            this.peerConnection, "mark active", peer,
        )
    }

    async showTable(table_data) {
        return remote.rpc(
            this.peerConnection, "show table", table_data,
        )
}

    async winner(winner) {
        return remote.rpc(
            this.peerConnection, "winner", winner,
        )
    }
}

customElements.define("g-player", Player);
customElements.define("g-remote", RemotePlayer);
