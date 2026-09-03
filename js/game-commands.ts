import type { DataConnection } from "peerjs";
import { COMMANDS, type Command } from "./commands";
import type { Player } from "./player";
import type { Layout } from "./layout";
import type { Board } from "./board";

export interface RemoteHandle {
  rpc(connection: DataConnection, method: Command, body?: any): Promise<any>;
  connectPeer(id: string): Promise<DataConnection>;
}

export interface CommandContext {
  sender: DataConnection;
  // The one non-remote `g-player` in this tab. Exactly one is expected to
  // exist; callers are responsible for locating it.
  localPlayer: Player;
  game: Layout;
  table: Board;
  remote: RemoteHandle;
  createRemotePlayer(connection: DataConnection, name: string): Player;
}

type Handler = (payload: any, ctx: CommandContext) => any;

const handlers: Record<Command, Handler> = {
  [COMMANDS.JOIN_GAME]: (_payload, ctx) => {
    for (const player of ctx.game.players) {
      player.addPlayer(ctx.sender);
    }
  },

  [COMMANDS.ADD_PLAYER]: async (payload, ctx) => {
    const peer = await ctx.remote.connectPeer(payload.id);
    await ctx.remote.rpc(peer, COMMANDS.CONNECT_PLAYERS, {
      name: ctx.localPlayer.name,
    });
  },

  [COMMANDS.CONNECT_PLAYERS]: (payload, ctx) => {
    const player = ctx.createRemotePlayer(ctx.sender, payload.name);
    ctx.game.addPlayer(player);
    return { name: ctx.localPlayer.name };
  },

  [COMMANDS.ARRANGE_PLAYERS]: (payload, ctx) => {
    ctx.game.arrangePlayers(payload);
  },

  [COMMANDS.DEAL]: (payload, ctx) => {
    return ctx.localPlayer.deal(payload);
  },

  [COMMANDS.ACTIVATE]: async (payload, ctx) => {
    await ctx.localPlayer.activate(payload.pool, payload.table_data);
  },

  [COMMANDS.MARK_ACTIVE]: async (payload, ctx) => {
    await ctx.game.markActive(payload);
  },

  [COMMANDS.SHOW_TABLE]: (payload, ctx) => {
    ctx.table.drawGame(payload);
  },

  [COMMANDS.WINNER]: (payload, ctx) => {
    return ctx.localPlayer.winner(payload);
  },
};

export async function dispatchCommand(
  method: string,
  payload: any,
  ctx: CommandContext,
): Promise<any> {
  const handler = handlers[method as Command];
  if (!handler) {
    console.warn("Unknown command:", method);
    return "ok";
  }
  const result = await handler(payload, ctx);
  return result === undefined ? "ok" : result;
}
