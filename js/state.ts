interface State {
  pool: string[];
  setPool(pool: string[]): void;
}

const state: State = {
  pool: [],
  setPool(pool: string[]): void {
    this.pool = pool;
  },
};

export default state;
