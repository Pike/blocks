import interact from "interactjs";
import { elements } from "./elements";
import state from "./state";
import {
  createStone,
  color_classes,
  Stone as StoneModel,
  type ColorClass,
} from "./model";

// Type definitions for interact.js events
interface InteractEvent {
  dx: number;
  dy: number;
  rect?: DOMRect;
  interactable?: any;
  dropzone?: any;
  relatedTarget?: HTMLElement;
  target?: HTMLElement;
}

const group_sheet = new CSSStyleSheet();
group_sheet.replaceSync(`
:host {
  display: inline-block;
  margin-right: 1ex;
}
`);

export class Group extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [group_sheet];
    shadow.innerHTML = `<slot></slot>`;
  }

  toString() {
    return Array.from(this.querySelectorAll("g-stone")).map(String).join("");
  }
}

const stone_sheet = new CSSStyleSheet();
stone_sheet.replaceSync(`
:host {
  display: inline-block;
}
span {
  border-radius: 5px;
  border: 1px solid black;
  display: inline-block;
  width: 4ex;
  height: 5ex;
  text-align: center;
  vertical-align: text-top;
  margin: 2px;
  margin-bottom: 1ex;
  background-color: #f5db9e;
}
`);

export class Stone extends HTMLElement {
  private stone_: StoneModel | undefined;

  constructor(serialized?: string) {
    super();
    this.stone_ = undefined;
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [stone_sheet];
    shadow.innerHTML = `
        <span><slot></slot></span>
        `;
    if (!serialized) {
      return;
    }
    this.stone = createStone(serialized);
  }

  get stone(): StoneModel | undefined {
    return this.stone_;
  }

  set stone(stone: StoneModel) {
    this.stone_ = stone;
    this.classList.forEach((c) => {
      if (color_classes.includes(c as ColorClass)) {
        this.classList.remove(c);
      }
    });
    this.classList.add(stone.color);
    this.textContent = stone.value;
  }

  toString(): string {
    return this.stone ? this.stone.toString() : " ";
  }

  connectedCallback(): void {
    const dragPosition = {
      x: 0,
      y: 0,
    };
    interact(this).draggable({
      listeners: {
        start: (_start: InteractEvent) => {
          dragPosition.x = 0;
          dragPosition.y = 0;
        },
        move: (move: InteractEvent) => {
          dragPosition.x += move.dx;
          dragPosition.y += move.dy;
          this.style.transform = `translate(${dragPosition.x}px, ${dragPosition.y}px)`;
        },
        end: (end: InteractEvent) => {
          const original_group = this.parentElement;
          this.maybeDrop(end);
          if (
            original_group &&
            original_group.localName === "g-group" &&
            original_group.childElementCount === 0
          ) {
            if (original_group.childElementCount === 0) {
              if (
                original_group.nextSibling &&
                original_group.nextSibling.nodeType === Node.TEXT_NODE
              ) {
                original_group.nextSibling.remove();
              }
              original_group.remove();
            }
          }
          dragPosition.x = 0;
          dragPosition.y = 0;
          this.style.transform = "";
        },
      },
    });
  }
  maybeDrop(end_event: any): void {
    if (!end_event.dropzone) {
      // drop aborted, don't move
      return;
    }
    const rect = end_event.rect || end_event.interactable.getRect();
    const cy = rect.top + rect.height / 2;
    const stones = Array.from(
      end_event.relatedTarget.querySelectorAll("g-stone"),
    ).filter((n: any) => n !== end_event.target) as any[];
    if (stones.length === 0) {
      const first_group = new Group();
      first_group.append(this);
      end_event.relatedTarget.append(first_group);
      end_event.relatedTarget.append(" ");
      return;
    }
    let node: any, drop_target: any;
    let new_block = true;
    while (stones.length > 3) {
      const pivot = Math.floor(stones.length / 2);
      node = stones[pivot];
      const candidate_rect = interact.getElementRect(node as any);
      if (cy < candidate_rect.top) {
        stones.splice(pivot, pivot + 1);
        continue;
      }
      if (cy > candidate_rect.bottom) {
        stones.splice(0, pivot + 1);
        continue;
      }
      if (
        candidate_rect.left <= rect.right &&
        rect.left <= candidate_rect.right
      ) {
        drop_target = node;
        new_block = false;
        break;
      }
      if (candidate_rect.right <= rect.left) {
        // We're off to the right, remove up to pivot
        stones.splice(0, pivot);
      } else {
        // We're off to the left, keep pivot and remove rest
        stones.splice(pivot + 1, pivot);
      }
    }
    let before: any,
      maybe_after = stones[stones.length - 1];
    if (!drop_target) {
      // Check remaining drop candidates one by one.
      // We either want a new block, or didn't find
      // the drop target in bisection.
      for (const node of stones) {
        const candidate_rect = interact.getElementRect(node as any);
        if (cy < candidate_rect.top) {
          before = node;
          break;
        }
        if (candidate_rect.top <= cy && cy <= candidate_rect.bottom) {
          // We're on the same row
          if (
            candidate_rect.left <= rect.right &&
            rect.left <= candidate_rect.right
          ) {
            drop_target = node;
            new_block = false;
            break;
          }
          if (candidate_rect.right < rect.left) {
            maybe_after = node;
          }
          if (rect.right < candidate_rect.left) {
            before = node;
            break;
          }
        }
        if (rect.top > candidate_rect.bottom) {
          // dropping below the current line
          maybe_after = node;
        }
      }
    }
    // Do we prepend or append to target?
    let position: InsertPosition = before ? "beforebegin" : "afterend";
    if (drop_target && (drop_target as HTMLElement).offsetLeft !== undefined) {
      if (rect.left > (drop_target as HTMLElement).offsetLeft) {
        position = "afterend";
      } else {
        position = "beforebegin";
      }
    } else {
      drop_target = before || maybe_after;
    }
    // Do we need to split the old block? Only if we're a series
    let next: Element | null, previous: Element | null;
    if (
      (next = this.nextElementSibling) &&
      (previous = this.previousElementSibling)
    ) {
      const nextStone = next as Stone;
      const prevStone = previous as Stone;
      if (
        nextStone.stone &&
        prevStone.stone &&
        prevStone.stone.value !== nextStone.stone.value &&
        prevStone.stone.color === nextStone.stone.color
      ) {
        const split_group = new Group();
        while (next) {
          split_group.append(next);
          next = this.nextElementSibling;
        }
        this.parentElement?.insertAdjacentElement("afterend", split_group);
        this.parentElement?.insertAdjacentText("afterend", " ");
      }
    }
    let drop_source: Element | Group = this;
    if (new_block) {
      drop_source = new Group();
      drop_target = (drop_target as Element)?.parentElement;
      drop_source.append(this);
    }
    (drop_target as Element)?.insertAdjacentElement(
      position,
      drop_source as Element,
    );
    const board = (drop_target as Element)?.closest("g-board") as Board;
    board?.space();
    if ((board as any)?.ondrop) {
      publishTable(end_event);
    }
  }
}

async function publishTable(_e: any): Promise<void> {
  const { table } = elements;
  if (!table) return;
  const table_data = (table as any).data();
  await Promise.all(
    Array.from(document.querySelectorAll("g-remote")).map((player) =>
      (player as any).showTable(table_data),
    ),
  );
}

export class Board extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback(): void {
    if (this.hasAttribute("drop")) {
      this.enableDrop();
    }
  }

  enableDrop(): void {
    interact(this).dropzone({
      overlap: "center",
    });
  }

  disableDrop(): void {
    interact(this).unset();
  }

  drawGame(serialized: string[]): void {
    const children = document.createDocumentFragment();
    for (const child of this.elems(serialized)) {
      children.append(child);
    }
    this.innerHTML = "";
    this.appendChild(children);
    this.space();
  }

  data(): string[] {
    return Array.from(this.querySelectorAll("g-group")).map(String);
  }

  space(): void {
    for (const g of this.querySelectorAll("g-group")) {
      if (!g.nextSibling) continue;
      if (g.nextSibling.nodeType !== Node.TEXT_NODE) {
        g.insertAdjacentText("afterend", " ");
      }
    }
  }

  get empty(): boolean {
    return this.querySelector("g-stone") === null;
  }

  appendStone(stone: StoneModel): void {
    const stone_el = new Stone();
    stone_el.stone = stone;
    const group = new Group();
    group.append(stone_el);
    this.append(group);
    this.append(" ");
  }

  *elems(serialized: string[]): Generator<HTMLElement> {
    let group: HTMLElement;
    for (const word of serialized) {
      group = document.createElement("g-group");
      for (const char of word) {
        group.appendChild(new Stone(char));
      }
      yield group;
    }
  }
}

const pool_sheet = new CSSStyleSheet();
pool_sheet.replaceSync(`
:host {
  display: inline-block;
  border-radius: 5px;
  border: 1px solid black;
  display: inline-block;
  width: 4ex;
  height: 5ex;
  text-align: center;
  vertical-align: text-top;
  margin: 2px;
  margin-bottom: 1ex;
  background-color: #f5db9e;
}
`);

export class Pool extends HTMLElement {
  constructor(_serialized?: string) {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [pool_sheet];
  }

  connectedCallback(): void {
    this.onclick = () => {
      nextPlayer();
    };
  }
}

function nextPlayer(): void {
  const { board, table } = elements;
  const { pool } = state;
  const current = document.querySelector("g-player.active");
  if (!current || !board || !table) {
    // We're not active
    return;
  }
  if ((board as any).empty) {
    declareWinner(current);
    return;
  }
  const next =
    current.nextElementSibling || current.parentElement?.firstElementChild;
  if ((current as any).needsStone) {
    const poolToken = pool.pop();
    if (poolToken) {
      (board as any).appendStone(createStone(poolToken));
    }
  }
  (current as any).deactivate();
  if (next) {
    (next as any).activate(pool, (table as any).data());
  }
}

async function declareWinner(winner: Element): Promise<void> {
  const { game } = elements;
  if (!game) return;
  await Promise.all(
    Array.from((game as any).players || []).map((player: any) =>
      player.winner(winner === player ? null : (winner as any).name),
    ),
  );
}

customElements.define("g-board", Board);
customElements.define("g-group", Group);
customElements.define("g-stone", Stone);
customElements.define("g-pool", Pool);
