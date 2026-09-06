import interact from "interactjs";
import { elements } from "./elements";
import {
  createTile,
  color_classes,
  Tile as TileModel,
  type ColorClass,
} from "./model";
import {
  resolvePlacement,
  shouldSplitCluster,
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

const cluster_sheet = new CSSStyleSheet();
cluster_sheet.replaceSync(`
:host {
  display: inline-block;
  margin-right: 1ex;
}
`);

export class Cluster extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [cluster_sheet];
    shadow.innerHTML = `<slot></slot>`;
  }

  toString() {
    return Array.from(this.querySelectorAll("g-tile")).map(String).join("");
  }
}

const tile_sheet = new CSSStyleSheet();
tile_sheet.replaceSync(`
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

export class Tile extends HTMLElement {
  private tile_: TileModel | undefined;

  constructor(serialized?: string) {
    super();
    this.tile_ = undefined;
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [tile_sheet];
    shadow.innerHTML = `
        <span><slot></slot></span>
        `;
    if (!serialized) {
      return;
    }
    this.tile = createTile(serialized);
  }

  get tile(): TileModel | undefined {
    return this.tile_;
  }

  set tile(tile: TileModel) {
    this.tile_ = tile;
    this.classList.forEach((c) => {
      if (color_classes.includes(c as ColorClass)) {
        this.classList.remove(c);
      }
    });
    this.classList.add(tile.color);
    this.textContent = tile.value;
  }

  toString(): string {
    return this.tile ? this.tile.toString() : " ";
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
          const original_cluster = this.parentElement;
          this.maybeDrop(end);
          if (
            original_cluster &&
            original_cluster.localName === "g-cluster" &&
            original_cluster.childElementCount === 0
          ) {
            if (original_cluster.childElementCount === 0) {
              if (
                original_cluster.nextSibling &&
                original_cluster.nextSibling.nodeType === Node.TEXT_NODE
              ) {
                original_cluster.nextSibling.remove();
              }
              original_cluster.remove();
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
    const tiles = Array.from(
      end_event.relatedTarget.querySelectorAll("g-tile"),
    ).filter((n: any) => n !== end_event.target) as any[];

    const indexed_rects: IndexedRect[] = tiles.map((node, index) => ({
      index,
      rect: interact.getElementRect(node as any),
    }));
    const placement = resolvePlacement(rect, indexed_rects);

    if (placement.kind === "empty-cluster") {
      const first_cluster = new Cluster();
      first_cluster.append(this);
      end_event.relatedTarget.append(first_cluster);
      end_event.relatedTarget.append(" ");
      return;
    }

    const new_block = placement.kind === "new-block";
    const position = placement.position;
    let drop_target: any =
      placement.kind === "insert"
        ? tiles[placement.targetIndex]
        : placement.anchorIndex !== null
          ? tiles[placement.anchorIndex]
          : undefined;

    // Do we need to split the old block? Only if we're a series
    let next: Element | null, previous: Element | null;
    if (
      (next = this.nextElementSibling) &&
      (previous = this.previousElementSibling)
    ) {
      const nextTile = next as Tile;
      const prevTile = previous as Tile;
      if (
        nextTile.tile &&
        prevTile.tile &&
        shouldSplitCluster(prevTile.tile, nextTile.tile)
      ) {
        const split_cluster = new Cluster();
        while (next) {
          split_cluster.append(next);
          next = this.nextElementSibling;
        }
        this.parentElement?.insertAdjacentElement("afterend", split_cluster);
        this.parentElement?.insertAdjacentText("afterend", " ");
      }
    }
    let drop_source: Element | Cluster = this;
    if (new_block) {
      drop_source = new Cluster();
      drop_target = (drop_target as Element)?.parentElement;
      drop_source.append(this);
    }
    (drop_target as Element)?.insertAdjacentElement(
      position,
      drop_source as Element,
    );
    const board = (drop_target as Element)?.closest("g-board") as Board;
    board?.space();
    if (board === elements.table) {
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
    return Array.from(this.querySelectorAll("g-cluster")).map(String);
  }

  space(): void {
    for (const g of this.querySelectorAll("g-cluster")) {
      if (!g.nextSibling) continue;
      if (g.nextSibling.nodeType !== Node.TEXT_NODE) {
        g.insertAdjacentText("afterend", " ");
      }
    }
  }

  get empty(): boolean {
    return this.querySelector("g-tile") === null;
  }

  appendTile(tile: TileModel): void {
    const tile_el = new Tile();
    tile_el.tile = tile;
    const cluster = new Cluster();
    cluster.append(tile_el);
    this.append(cluster);
    this.append(" ");
  }

  *elems(serialized: string[]): Generator<HTMLElement> {
    let cluster: HTMLElement;
    for (const word of serialized) {
      cluster = document.createElement("g-cluster");
      for (const char of word) {
        cluster.appendChild(new Tile(char));
      }
      yield cluster;
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
      elements.game.nextPlayer();
    };
  }
}

customElements.define("g-board", Board);
customElements.define("g-cluster", Cluster);
customElements.define("g-tile", Tile);
customElements.define("g-pool", Pool);
