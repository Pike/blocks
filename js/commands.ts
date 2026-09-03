export const COMMANDS = {
  JOIN_GAME: "join game",
  ADD_PLAYER: "add player",
  CONNECT_PLAYERS: "connect players",
  ARRANGE_PLAYERS: "arrange players",
  DEAL: "deal",
  ACTIVATE: "activate",
  MARK_ACTIVE: "mark active",
  SHOW_TABLE: "show table",
  WINNER: "winner",
} as const;

export type Command = (typeof COMMANDS)[keyof typeof COMMANDS];
