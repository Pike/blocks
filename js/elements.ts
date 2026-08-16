import type { Board } from "./board";
import type { Layout } from "./layout";

export const elements = {
  get board(): Board {
    const element = document.getElementById("board");
    if (!element) {
      throw new Error("Board element not found in DOM");
    }
    return element as Board;
  },
  get table(): Board {
    const element = document.getElementById("table");
    if (!element) {
      throw new Error("Table element not found in DOM");
    }
    return element as Board;
  },
  get game(): Layout {
    const element = document.querySelector("g-layout");
    if (!element) {
      throw new Error("Game layout element not found in DOM");
    }
    return element as Layout;
  },
};
