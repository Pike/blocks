import { Board } from "./board.js";

export class Layout extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = `
        <style>
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
        </style>
        <div class="left">
            <slot name="table"></slot>
            <slot name="board"></slot>
        </div>
        <div class="right">
            <slot name="players"></slot>
        </div>
        <slot name="pool"></slot>
        `
        this.innerHTML = `
        <g-board slot="table" id="table" ondrop></g-board>
        <g-pool slot="pool"></g-pool>
        <g-board slot="board" id="board" drop></g-board>
        <div slot="players">
        </div>
        `
    }

    get players() {
        return this.querySelectorAll("g-player, g-remote");
    }

    mapPlayers(fun) {
        return Array.from(this.players).map(fun);
    }

    addPlayer(player) {
        this.querySelector("[slot=players]").append(player);
    }

    arrangePlayers(player_ids) {
        const container = this.querySelector("[slot=players]");
        while (player_ids.length) {
            const player_id = player_ids.pop();
            for (const player of container.children) {
                if (player.peer === player_id) {
                    container.append(player);
                    break;
                }
            }
        }
    }

    markActive(peer) {
        const container = this.querySelector("[slot=players]");
        for (const player of container.querySelectorAll(".active")) {
            player.classList.remove("active");
        }
        for (const player of container.children) {
            if (player.peer === peer) {
                player.classList.add("active");
            }
        }
    }
}

customElements.define("g-layout", Layout);
