import type { Player } from "./player";
// Type definitions for custom elements
interface BoardElement extends HTMLElement {
  drawGame(serialized: string[]): void;
  data(): string[];
  space(): void;
  empty: boolean;
  appendStone(stone: any): void;
  enableDrop(): void;
  disableDrop(): void;
}

interface LayoutElement extends HTMLElement {
  players: NodeListOf<Player>;
  mapPlayers<T>(fun: (player: Player) => T): T[];
  addPlayer(player: Player): void;
  arrangePlayers(player_ids: string[]): void;
  markActive(peer: string): void;
}

export const elements = {
  get board(): BoardElement {
    const element = document.getElementById("board");
    if (!element) {
      throw new Error("Board element not found in DOM");
    }
    if (!this.isBoardElement(element)) {
      throw new Error(
        "Board element does not implement BoardElement interface",
      );
    }
    return element as BoardElement;
  },
  get table(): BoardElement {
    const element = document.getElementById("table");
    if (!element) {
      throw new Error("Table element not found in DOM");
    }
    if (!this.isBoardElement(element)) {
      throw new Error(
        "Table element does not implement BoardElement interface",
      );
    }
    return element as BoardElement;
  },
  get game(): LayoutElement {
    const element = document.querySelector("g-layout");
    if (!element) {
      throw new Error("Game layout element not found in DOM");
    }
    if (!this.isLayoutElement(element)) {
      throw new Error(
        "Game element does not implement LayoutElement interface",
      );
    }
    return element as LayoutElement;
  },

  // Type guard functions
  isBoardElement(element: HTMLElement): element is BoardElement {
    return (
      typeof (element as any).drawGame === "function" &&
      typeof (element as any).data === "function" &&
      typeof (element as any).space === "function" &&
      typeof (element as any).appendStone === "function" &&
      typeof (element as any).enableDrop === "function" &&
      typeof (element as any).disableDrop === "function" &&
      "empty" in element
    );
  },

  isLayoutElement(element: Element): element is LayoutElement {
    return (
      element instanceof HTMLElement &&
      typeof (element as any).mapPlayers === "function" &&
      typeof (element as any).addPlayer === "function" &&
      typeof (element as any).arrangePlayers === "function" &&
      typeof (element as any).markActive === "function" &&
      "players" in element
    );
  },
};
