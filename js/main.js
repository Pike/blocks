let table, board, deck, pool, model, game;

Promise.all([
    import("./model.js"),
    import("./layout.js"),
    import("./player.js"),
]).then((modules) => {
    table = document.getElementById("table");
    board = document.getElementById("board");
    game = document.querySelector("g-layout");
    model = modules[0];
    boot();
});

async function boot() {
    const params = new URLSearchParams(document.location.search);
    await remote.beMyself(params.get("name"));
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
    deck = new model.Deck();
    shuffle(deck.cards);
    pool = deck.cards.map(String);
    await comms;
    for (const player of game.players) {
        pool = await player.deal(pool);
    }
    game.players[0].activate(pool, "");
}

async function publishTable(e) {
    const table_data = table.data();
    await Promise.all(Array.from(document.querySelectorAll("g-remote"))
        .map(player => player.showTable(table_data))
    );
}

function nextPlayer() {
    const current = document.querySelector("g-player.active");
    if (!current) {
        // We're not active
        return;
    }
    if (board.empty) {
        declareWinner(current);
        return;
    }
    const next = current.nextElementSibling || current.parentElement.firstElementChild;
    if (current.needsStone) {
        board.pullStone(pool);
    }
    current.deactivate();
    next.activate(pool, table.data());
}

async function declareWinner(winner) {
    await Promise.all(
        Array.from(game.players)
        .map(player => player.winner(winner === player ? null : winner.name))
    )
}

function shuffle(array) {
    const len = array.length;
    for (let start = 0; start < len - 1; ++start) {
        const other = Math.floor(Math.random() * len);
        [array[start], array[other]] = [array[other], array[start]];
    }
}
