import { remote } from "./remote.js";
import { Player } from "./player.js";
import { Deck } from "./model.js"
let table, board, game;

Promise.all([
    import("./layout.js"),
]).then(() => {
    table = document.getElementById("table");
    board = document.getElementById("board");
    game = document.querySelector("g-layout");
});

document.addEventListener("DOMContentLoaded", async () => {
    setupMenu();
    const name = globalThis.localStorage.getItem("name");
    const host = globalThis.localStorage.getItem("host");
    const userDialog = document.getElementById("users");
    const nameInput = userDialog.querySelector("input[name=name]");
    const hostInput = userDialog.querySelector("input[name=host]");
    const [hostCheck, otherHostCHeck] = userDialog.querySelectorAll("input[name=isHost]");
    const bots = userDialog.querySelector("input[name=bots]");
    hostCheck.addEventListener("change", (event) => {
        hostInput.disabled = true;
        hostInput.required = false;
        bots.parentElement.style.visibility = "inherit";
    });
    otherHostCHeck.addEventListener("change", (event) => {
        hostInput.disabled = false;
        hostInput.required = true;
        bots.parentElement.style.visibility = "hidden";
    }
    );
    nameInput.value = name || "";
    hostInput.value = host || "";
    if (!host) {
        otherHostCHeck.checked = true;
    }
    userDialog.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = nameInput.value;
        const host = hostInput.value;
        globalThis.localStorage.setItem("name", name);
        globalThis.localStorage.setItem("host", host);
        userDialog.close();
        boot();
    }
    );
    userDialog.showModal();
});

function setupMenu() {
    const menu = document.getElementById("menu");
    const startGame = document.getElementById("startGame");
    const settings = document.getElementById("settings");
    startGame.addEventListener("click", async (event) => {
        await deal();
        menu.hide();
    });
    settings.addEventListener("click", (event) => {
        menu.hide();
    });
}

async function boot() {
    const name = globalThis.localStorage.getItem("name");
    const host = globalThis.localStorage.getItem("host");
    const id = await remote.beMyself(name);
    const player = new Player(name, id);
    game.addPlayer(player);
    if (host) {
        await remote.connectToHostedGame(host);
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
