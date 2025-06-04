import type { SlDropdown } from "@shoelace-style/shoelace";
import { remote } from "./remote";
import { Player } from "./player";
import { Deck } from "./model";
import { elements } from "./elements";

document.addEventListener("DOMContentLoaded", async () => {
  await customElements.whenDefined("g-layout");
  setupMenu();
  const name = globalThis.localStorage.getItem("name");
  const host = globalThis.localStorage.getItem("host");
  const userDialog = document.getElementById("users");
  if (!userDialog || !(userDialog instanceof HTMLDialogElement)) {
    throw new Error("User dialog not found in DOM");
  }
  const nameInput =
    userDialog.querySelector<HTMLInputElement>("input[name=name]");
  const hostInput =
    userDialog.querySelector<HTMLInputElement>("input[name=host]");
  if (!nameInput || !hostInput) {
    throw new Error("Name or host input not found in user dialog");
  }
  const [hostCheck, otherHostCHeck] =
    userDialog.querySelectorAll<HTMLInputElement>("input[name=isHost]");
  const bots = userDialog.querySelector("input[name=bots]");
  const botsParent = bots?.parentElement;
  if (!botsParent) {
    throw new Error("Bots input not found in user dialog");
  }

  hostCheck.addEventListener("change", () => {
    hostInput.disabled = true;
    hostInput.required = false;
    botsParent.style.visibility = "inherit";
  });
  otherHostCHeck.addEventListener("change", () => {
    hostInput.disabled = false;
    hostInput.required = true;
    botsParent.style.visibility = "hidden";
  });
  nameInput.value = name || "";
  hostInput.value = host || "";
  if (host) {
    otherHostCHeck.checked = true;
  } else {
    hostCheck.checked = true;
  }
  userDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value;
    const host = hostInput.value;
    globalThis.localStorage.setItem("name", name);
    globalThis.localStorage.setItem("host", host);
    userDialog.close();
    boot();
  });
  userDialog.showModal();
});

function setupMenu() {
  const menu = document.getElementById("menu") as SlDropdown;
  const startGame = document.getElementById("startGame");
  const settings = document.getElementById("settings");
  if (!menu || !startGame || !settings) {
    throw new Error("Menu, startGame or settings element not found in DOM");
  }
  startGame.addEventListener("click", async () => {
    await deal();
    menu.hide();
  });
  settings.addEventListener("click", () => {
    menu.hide();
  });
}

async function boot() {
  const name = globalThis.localStorage.getItem("name");
  const host = globalThis.localStorage.getItem("host");
  if (!name) {
    throw new Error("Name not set in localStorage");
  }
  const { game } = elements;
  const id = await remote.beMyself(name);
  const player = new Player(name || "", remote, id);
  game.addPlayer(player);
  if (host) {
    await remote.connectToHostedGame(host);
  }
}

async function deal() {
  const { game } = elements;
  const players_ids = game.mapPlayers((player) => player.peer);
  shuffle(players_ids);
  let comms = Promise.all(
    game.mapPlayers((player) => player.arrangePlayers(players_ids)),
  );
  const deck = new Deck();
  shuffle(deck.cards);
  let pool = deck.cards.map(String);
  // let pool = Array.from(deck.cards);
  await comms;
  for (const player of game.players) {
    pool = await player.deal(pool);
  }
  game.players[0].activate(pool, [""]);
}

declare global {
  // eslint-disable-next-line no-var
  var deal: () => Promise<void>;
}
globalThis.deal = deal;

function shuffle<T>(array: T[]) {
  const len = array.length;
  for (let start = 0; start < len - 1; ++start) {
    const other = Math.floor(Math.random() * len);
    [array[start], array[other]] = [array[other], array[start]];
  }
}
