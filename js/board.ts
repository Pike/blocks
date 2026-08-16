import interact from "interactjs";
import { elements } from "./elements";
import type { Player } from "./player";
import state from "./state";
import {
  createStone,
  color_classes,
  Stone as StoneModel,
  type ColorClass,
} from "./model";
import {
  resolvePlacement,
  shouldSplitGroup,
  type IndexedRect,
} from "./drop-placement";

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
    const stones = Array.from(
      end_event.relatedTarget.querySelectorAll("g-stone"),
    ).filter((n: any) => n !== end_event.target) as any[];

    const indexed_rects: IndexedRect[] = stones.map((node, index) => ({
      index,
      rect: interact.getElementRect(node as any),
    }));
    const placement = resolvePlacement(rect, indexed_rects);

    if (placement.kind === "empty-group") {
      const first_group = new Group();
      first_group.append(this);
      end_event.relatedTarget.append(first_group);
      end_event.relatedTarget.append(" ");
      return;
    }

    const new_block = placement.kind === "new-block";
    const position = placement.position;
    let drop_target: any =
      placement.kind === "insert"
        ? stones[placement.targetIndex]
        : placement.anchorIndex !== null
          ? stones[placement.anchorIndex]
          : undefined;

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
        shouldSplitGroup(prevStone.stone, nextStone.stone)
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
  const current = document.querySelector("g-player.active") as Player | null;
  if (!current || !board || !table) {
    // We're not active
    return;
  }
  if (board.empty) {
    declareWinner(current);
    return;
  }
  const next = (current.nextElementSibling ||
    current.parentElement?.firstElementChild) as Player | undefined;
  if (current.needsStone) {
    const poolToken = pool.pop();
    if (poolToken) {
      board.appendStone(createStone(poolToken));
    }
  }
  current.deactivate();
  if (next) {
    next.activate(pool, table.data());
  }
}

async function declareWinner(winner: Player): Promise<void> {
  const { game } = elements;
  if (!game) return;
  await Promise.all(
    Array.from(game.players).map((player) =>
      player.winner(winner === player ? undefined : winner.name || undefined),
    ),
  );
}

customElements.define("g-board", Board);
customElements.define("g-group", Group);
customElements.define("g-stone", Stone);
customElements.define("g-pool", Pool);
