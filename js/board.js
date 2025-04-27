import interact from "interactjs";
import { elements } from "./elements.js";
import state from "./state.js";
import { createStone, color_classes } from "./model.js";

export class Group extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.innerHTML = `
        <style>
        :host {
            display: inline-block;
            margin-right: 1ex;
        }
        </style>
        <slot></slot>
        `
    }

    toString() {
        return Array.from(this.querySelectorAll("g-stone")).map(String).join("");
    }
}

export class Stone extends HTMLElement {
    constructor(serialized) {
        super();
        this.stone_ = undefined;
        const shadow = this.attachShadow({mode: "open"});
        shadow.innerHTML = `
        <style>
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
        </style>
        <span><slot></slot></span>
        `
        if (!serialized) {
            return
        }
        this.stone = createStone(serialized);
    }

    get stone() {
        return this.stone_;
    }

    set stone(stone) {
        this.stone_ = stone;
        this.classList.forEach(c => {
            if (color_classes.includes(c)) {
                this.classList.remove(c);
            }
        })
        this.classList.add(stone.color);
        this.textContent = stone.value;
    }

    toString() {
        return this.stone ? this.stone.toString() : " ";
    }

    connectedCallback() {
        const dragPosition = {
            x:0,
            y:0,
        }
        interact(this)
        .draggable({
            listeners: {
                start: (start) => {
                    dragPosition.x = 0;
                    dragPosition.y = 0;
                },
                move: (move) => {
                    dragPosition.x += move.dx;
                    dragPosition.y += move.dy;
                    this.style.transform = `translate(${dragPosition.x}px, ${dragPosition.y}px)`;
                },
                end: (end) => {
                    const original_group = this.parentElement;
                    this.maybeDrop(end);
                    if (original_group.localName === 'g-group' && original_group.childElementCount === 0) {
                        if (original_group.childElementCount === 0) {
                            if (original_group.nextSibling && original_group.nextSibling.nodeType === Node.TEXT_NODE) {
                                original_group.nextSibling.remove();
                            }
                            original_group.remove();
                        }
                
                    }
                    dragPosition.x = 0;
                    dragPosition.y = 0;
                    this.style.transform = '';
                }
            }
        })
    }
    maybeDrop(end_event) {
        if (!end_event.dropzone) {
            // drop aborted, don't move
            return;
        }
        const rect = end_event.rect || end_event.interactable.getRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const stones = Array
            .from(end_event.relatedTarget.querySelectorAll("g-stone"))
            .filter(n => n !== end_event.target);
        if (stones.length === 0) {
            const first_group = new Group();
            first_group.append(this);
            end_event.relatedTarget.append(first_group);
            end_event.relatedTarget.append(" ");
            return;
        }
        let node, drop_target;
        let new_block = true;
        while (stones.length > 3) {
            const pivot = Math.floor(stones.length/2);
            node = stones[pivot];
            const candidate_rect = interact.getElementRect(node);
            if (cy < candidate_rect.top) {
                stones.splice(pivot, pivot + 1);
                continue
            }
            if (cy > candidate_rect.bottom) {
                stones.splice(0, pivot + 1);
                continue
            }
            if (candidate_rect.left <= rect.right && rect.left <= candidate_rect.right ) {
                drop_target = node;
                new_block = false;
                break
            }
            if (candidate_rect.right <= rect.left) {
                // We're off to the right, remove up to pivot
                stones.splice(0, pivot);
            }
            else {
                // We're off to the left, keep pivot and remove rest
                stones.splice(pivot + 1, pivot)
            }
        }
        let before, maybe_after = stones[stones.length - 1];
        if (!drop_target) {
            // Check remaining drop candidates one by one.
            // We either want a new block, or didn't find
            // the drop target in bisection.
            for (const node of stones) {
                const candidate_rect = interact.getElementRect(node);
                if (cy < candidate_rect.top) {
                    before = node;
                    break;
                }
                if (
                    candidate_rect.top <= cy &&
                    cy <= candidate_rect.bottom
                ) {
                    // We're on the same row
                    if (
                        candidate_rect.left <= rect.right &&
                        rect.left <= candidate_rect.right
                    ) {
                        drop_target = node;
                        new_block = false;
                        break
                    }
                    if (candidate_rect.right < rect.left) {
                        maybe_after = node;
                    }
                    if (rect.right < candidate_rect.left) {
                        before = node;
                        break
                    }
                }
                if (rect.top > candidate_rect.bottom) {
                    // dropping below the current line
                    maybe_after = node;
                }
            }
        }
        // Do we prepend or append to target?
        let position = before ? "beforebegin" : "afterend";
        if (drop_target) {
            if (rect.left > drop_target.offsetLeft) {
                position = "afterend";
            }
            else {
                position = "beforebegin";
            }
        }
        else {
            drop_target = before || maybe_after;
        }
        // Do we need to split the old block? Only if we're a series
        let next, previous;
        if ((next = this.nextElementSibling) && (previous = this.previousElementSibling)) {
            if (previous.stone.value !== next.stone.value && previous.stone.color === next.stone.color) {
                const split_group = new Group();
                while (next) {
                    split_group.append(next);
                    next = this.nextElementSibling;
                }
                this.parentElement.insertAdjacentElement("afterend", split_group);
                this.parentElement.insertAdjacentText("afterend", " ");
            }
        }
        let drop_source = this;
        if (new_block) {
            drop_source = new Group();
            drop_target = drop_target.parentElement;
            drop_source.append(this);
        }
        drop_target.insertAdjacentElement(position, drop_source);
        const board = drop_target.closest("g-board");
        board.space();
        if (board.ondrop) {
            publishTable(end_event);
        }
    }
}

async function publishTable(e) {
    const { table } = elements;
    const table_data = table.data();
    await Promise.all(Array.from(document.querySelectorAll("g-remote"))
        .map(player => player.showTable(table_data))
    );
}

export class Board extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        if (this.hasAttribute("drop")) {
            this.enableDrop();
        }
    }

    enableDrop() {
        interact(this)
        .dropzone({
            overlap: "center",
        });
    }

    disableDrop() {
        interact(this).unset();
    }

    drawGame(serialized) {
        const children = document.createDocumentFragment();
        for (const child of this.elems(serialized)) {
            children.append(child)
        }
        this.innerHTML = "";
        this.appendChild(children);
        this.space();
    }

    data() {
        return Array.from(this.querySelectorAll("g-group")).map(String);
    }

    space() {
        for (const g of this.querySelectorAll("g-group")) {
            if (!g.nextSibling) continue
            if (g.nextSibling.nodeType !== Node.TEXT_NODE) {
                g.insertAdjacentText("afterend", " ");
            }
        }
    }

    get empty() {
        return this.querySelector("g-stone") === null;
    }

    appendStone(stone) {
        const stone_el = new Stone();
        stone_el.stone = stone;
        const group = new Group();
        group.append(stone_el);
        this.append(group);
        this.append(" ");
    }

    *elems(serialized) {
        let group;
        for (const word of serialized) {
            group = document.createElement("g-group");
            for (const char of word) {
                group.appendChild(new Stone(char));
            }
            yield group;
        }
    }
}

export class Pool extends HTMLElement {
    constructor(serialized) {
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.innerHTML = `
        <style>
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
        </style>
        <span> </span>
        `
    }
    connectedCallback() {
        this.onclick = () => {
            nextPlayer();
        }
    }
}

function nextPlayer() {
    const {board, table} = elements;
    const {pool} = state;
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
        board.appendStone(createStone(pool.pop()));
    }
    current.deactivate();
    next.activate(pool, table.data());
}


async function declareWinner(winner) {
    const {game} = elements;
    await Promise.all(
        Array.from(game.players)
        .map(player => player.winner(winner === player ? null : winner.name))
    )
}

customElements.define("g-board", Board);
customElements.define("g-group", Group);
customElements.define("g-stone", Stone);
customElements.define("g-pool", Pool);
