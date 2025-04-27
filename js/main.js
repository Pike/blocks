import { remote } from "./remote.js";
import { Player } from "./player.js";
import {Deck} from "./model.js"
let table, board, game;

Promise.all([
    import("./layout.js"),
]).then(() => {
    table = document.getElementById("table");
    board = document.getElementById("board");
    game = document.querySelector("g-layout");
    boot();
});

async function boot() {
    const params = new URLSearchParams(document.location.search);
    const myself = params.get("name");
    const id = await remote.beMyself(myself);
    const player = new Player(myself, id);
    game.addPlayer(player);
    if (params.has("host")) {
        await remote.connectToHostedGame(params.get("host"));
    }
}

async function deal() {
    const players_ids = game.mapPlayers((player) => player.peer);
    shuffle(players_ids);
    let comms = Promise.all(game.mapPlayers(
        (player) => player.arrangePlayers(players_ids)
    ));
    const deck = new Deck();
    shuffle(deck.cards);
    let pool = deck.cards.map(String);
    await comms;
    for (const player of game.players) {
        pool = await player.deal(pool);
    }
    game.players[0].activate(pool, "");
}
globalThis.deal = deal;

function shuffle(array) {
    const len = array.length;
    for (let start = 0; start < len - 1; ++start) {
        const other = Math.floor(Math.random() * len);
        [array[start], array[other]] = [array[other], array[start]];
    }
}
