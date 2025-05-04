import exlusivePaper from "../textures/exclusive_paper.png";

const DIALOG_INNER = (function () {
  const template = document.createElement("template");
  template.innerHTML = `
<style>
.outer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    grid-template-columns: 1fr auto 1fr;
}
.inner {
    grid-column: 2;
    grid-row: 2;
    padding: 3ex;
    border-radius: 20px;
    background-image: url("${exlusivePaper}");
}
</style>
<div class="outer">
  <div class="inner">
    <slot></slot>
  </div>
</div>
    `;
  return template.content;
})();

class Dialog extends HTMLElement {
  constructor() {
    super();
    this.timeout_ = null;
    this.listener_ = null;
    this.resolve_ = null;
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(DIALOG_INNER.cloneNode(true));
    this.addEventListener("click", () => this.close());
  }

  waitForClose(timeout = 10 * 1000) {
    return new Promise((resolve, reject) => {
      if (this.resolve_) {
        reject("Only one waiting promise supported");
      } else {
        this.resolve_ = resolve;
        this.timeout_ = window.setTimeout(() => this.close(), timeout);
      }
    });
  }

  close() {
    this.remove();
    if (this.timeout_ !== null) {
      window.clearTimeout(this.timeout_);
      this.timeout_ = null;
    }
    if (this.resolve_) {
      this.resolve_();
      this.resolve_ = null;
    }
  }
}

customElements.define("g-dialog", Dialog);
const registered = customElements.whenDefined("g-dialog");

export async function winner(winner) {
  await registered;
  const dialog = document.createElement("g-dialog");
  dialog.innerHTML = `
<h1>Game over</h1>
<p>${winner} won</p>
    `;
  document.body.append(dialog);
  return dialog.waitForClose();
}
