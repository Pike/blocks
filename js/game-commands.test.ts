import { describe, expect, it, vi } from "vitest";
import { COMMANDS } from "./commands";
import { dispatchCommand, type CommandContext } from "./game-commands";
import type { Player } from "./player";
import type { Layout } from "./layout";
import type { Board } from "./board";

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const localPlayer = {
    name: "Alice",
    deal: vi.fn(async (pool: string[]) => pool),
    activate: vi.fn(async () => {}),
    winner: vi.fn((winner?: string) => `winner:${winner}`),
    addPlayer: vi.fn(async () => {}),
  } as unknown as Player;

  const game = {
    players: [] as Player[],
    addPlayer: vi.fn(),
    arrangePlayers: vi.fn(),
    markActive: vi.fn(async () => {}),
  } as unknown as Layout;

  const table = {
    drawGame: vi.fn(),
  } as unknown as Board;

  const remote = {
    rpc: vi.fn(async () => ({})),
    connectPeer: vi.fn(async () => ({ peer: "new-peer-id" }) as any),
  };

  const createRemotePlayer = vi.fn(
    (_connection, name: string) => ({ name }) as unknown as Player,
  );

  return {
    sender: { peer: "sender-id" } as any,
    localPlayer,
    game,
    table,
    remote,
    createRemotePlayer,
    ...overrides,
  };
}

describe("dispatchCommand", () => {
  it("join game: adds sender to every player in the game", async () => {
    const ctx = makeContext();
    const p1 = { addPlayer: vi.fn(async () => {}) } as unknown as Player;
    const p2 = { addPlayer: vi.fn(async () => {}) } as unknown as Player;
    ctx.game = { ...ctx.game, players: [p1, p2] } as unknown as Layout;

    await dispatchCommand(COMMANDS.JOIN_GAME, {}, ctx);

    expect(p1.addPlayer).toHaveBeenCalledWith(ctx.sender);
    expect(p2.addPlayer).toHaveBeenCalledWith(ctx.sender);
  });

  it("add player: connects to the new peer and relays connect players", async () => {
    const ctx = makeContext();

    await dispatchCommand(COMMANDS.ADD_PLAYER, { id: "peer-42" }, ctx);

    expect(ctx.remote.connectPeer).toHaveBeenCalledWith("peer-42");
    expect(ctx.remote.rpc).toHaveBeenCalledWith(
      { peer: "new-peer-id" },
      COMMANDS.CONNECT_PLAYERS,
      { name: "Alice" },
    );
  });

  it("connect players: adds a remote player and responds with the local name", async () => {
    const ctx = makeContext();

    const response = await dispatchCommand(
      COMMANDS.CONNECT_PLAYERS,
      { name: "Bob" },
      ctx,
    );

    expect(ctx.createRemotePlayer).toHaveBeenCalledWith(ctx.sender, "Bob");
    expect(ctx.game.addPlayer).toHaveBeenCalled();
    expect(response).toEqual({ name: "Alice" });
  });

  it("arrange players: forwards the ordering to the game", async () => {
    const ctx = makeContext();

    await dispatchCommand(COMMANDS.ARRANGE_PLAYERS, ["a", "b"], ctx);

    expect(ctx.game.arrangePlayers).toHaveBeenCalledWith(["a", "b"]);
  });

  it("deal: delegates to the local player and returns its result", async () => {
    const ctx = makeContext();

    const response = await dispatchCommand(COMMANDS.DEAL, ["s1", "s2"], ctx);

    expect(ctx.localPlayer.deal).toHaveBeenCalledWith(["s1", "s2"]);
    expect(response).toEqual(["s1", "s2"]);
  });

  it("activate: activates the local player with pool and table data", async () => {
    const ctx = makeContext();

    await dispatchCommand(
      COMMANDS.ACTIVATE,
      { pool: ["s1"], table_data: ["t1"] },
      ctx,
    );

    expect(ctx.localPlayer.activate).toHaveBeenCalledWith(["s1"], ["t1"]);
  });

  it("mark active: forwards the peer to the game", async () => {
    const ctx = makeContext();

    await dispatchCommand(COMMANDS.MARK_ACTIVE, "peer-1", ctx);

    expect(ctx.game.markActive).toHaveBeenCalledWith("peer-1");
  });

  it("show table: draws the table data", async () => {
    const ctx = makeContext();

    await dispatchCommand(COMMANDS.SHOW_TABLE, ["t1", "t2"], ctx);

    expect(ctx.table.drawGame).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("winner: delegates to the local player and returns its result", async () => {
    const ctx = makeContext();

    const response = await dispatchCommand(COMMANDS.WINNER, "Carol", ctx);

    expect(ctx.localPlayer.winner).toHaveBeenCalledWith("Carol");
    expect(response).toBe("winner:Carol");
  });

  it("defaults to 'ok' for handlers that return nothing", async () => {
    const ctx = makeContext();

    const response = await dispatchCommand(COMMANDS.ARRANGE_PLAYERS, [], ctx);

    expect(response).toBe("ok");
  });

  it("returns 'ok' for an unknown command instead of throwing", async () => {
    const ctx = makeContext();

    const response = await dispatchCommand("not a real command", {}, ctx);

    expect(response).toBe("ok");
  });
});
