# Remote over WebRTC

Some documentation on how we interact between players over WebRTC/PeerJS.

## RPC

Remote procedure calls want a payload to go from one peer to another, with a response body. WebRTC only offers one-way messages and event handlers, so there's some additional plumbing to do.

The messages sent via `dataConnection.send` are at least having a type:

```typescript
interface BaseMessage {
  type: string;
}
```

For starting an RPC call, a message like this is sent:

```typescript
interface RPCSendMessage extends BaseMessage {
  type: "call";
  msgId: string;
  method: string;
  body: any;
}
```

The response is given by the interface

```typescript
interface RPCResponseMessage extends BaseMessage {
  type: "call response";
  msgId: string;
  body: any;
}
```

The addition of the `msgId` allows to map messages from concurrent RPC calls to the initial caller.

## Table Setup

The initial setup of the table achieves is building data connections between all players, sharing name and peer ID. The process is marshaled by the host.

1. The host connects to the PeerJS server to be discoverable by the other players.
1. Each player connects to the PeerJS server to be discoverable.
1. Each player connects to the host establishing their first data connection.
1. The player calls the `join game` RPC method on the host.
1. The host shares the new peer ID with each existing peer per the `add player` RPC method.
1. The existing peer creates a connection with the new peer, and exchanges meta data via the `connect players` RPC method.
