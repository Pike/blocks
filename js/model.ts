export const color_classes = ["black", "blue", "orange", "red"] as const;
export type ColorClass = (typeof color_classes)[number];

export class Stone {
  color: ColorClass;
  value: string;

  constructor(color: ColorClass, value: string) {
    this.color = color;
    this.value = value;
  }

  toString(): string {
    let val: number;
    switch (this.value.slice(0, 2)) {
      case "🤴":
        val = 14;
        break;
      default:
        val = Number(this.value);
    }
    val = val << 2;
    val += color_classes.indexOf(this.color);
    return String.fromCodePoint(val);
  }
}

export function createStone(token: string): Stone {
  let codepoint = token.codePointAt(0)!;
  const color_num = codepoint % 4;
  let value: string | number = codepoint >> 2;
  if (value == 14) {
    value = "🤴" + (color_num === 0 ? "🏿" : "🏻");
  } else {
    value = String(value);
  }
  return new Stone(color_classes[color_num], value);
}

export class Deck {
  cards: Stone[];

  constructor() {
    const double_cols = color_classes.concat(color_classes);
    const values = Array(13)
      .fill(0)
      .map((_, i) => String(i + 1));
    this.cards = ([] as Stone[]).concat(
      [new Stone("black", "🤴🏿"), new Stone("red", "🤴🏻")],
      ...double_cols.map((color) => values.map((val) => new Stone(color, val))),
    );
  }
  shuffle(): void {
    const len = this.cards.length;
    for (let start = 0; start < len - 1; ++start) {
      const other = Math.floor(Math.random() * len);
      [this.cards[start], this.cards[other]] = [
        this.cards[other],
        this.cards[start],
      ];
    }
  }
  pop(): Stone | undefined {
    return this.cards.pop();
  }
  toString(): string {
    return this.cards.map((c) => String(c)).join("");
  }
}
