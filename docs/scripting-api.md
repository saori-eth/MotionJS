# Motion.js Scripting API Documentation

Welcome to the Motion.js Scripting API! This document provides a comprehensive guide to writing custom scripts for your Motion.js projects. With this API, you can create interactive experiences, define game logic, and build unique features for your virtual worlds.

## Getting Started

Scripts are TypeScript files located in the `scripts/` directory at the root of your project. Each script should export a default function that accepts the `ScriptContext` object.

```typescript
// scripts/my-script.ts
import { ScriptContext } from '@motionjs/common';

export default async function myScript(ctx: ScriptContext) {
  console.log('My script is running!');

  if (ctx.isClient) {
    // Client-side logic here
  }

  if (ctx.isServer) {
    // Server-side logic here
  }
}
```

## The `ScriptContext` Object

The `ScriptContext` object (`ctx`) is the primary interface for interacting with the Motion.js engine. It provides access to world information, event listeners, and functionality specific to either the client or the server.

### Core Properties

These properties are available on both the client and the server.

| Property        | Type      | Description                                                       |
| --------------- | --------- | ----------------------------------------------------------------- |
| `isClient`      | `boolean` | `true` if the script is running on the client, `false` otherwise. |
| `isServer`      | `boolean` | `true` if the script is running on the server, `false` otherwise. |
| `world`         | `World`   | A reference to the underlying ECS world object.                   |
| `localPlayerId` | `string?` | The ID of the local player. Only available on the client.         |

---

## Core API (Client & Server)

These functions are available in both client and server scripts.

### `onUpdate(callback)`

Registers a function to be called on every frame (tick on the server).

- `callback: (deltaTime: number) => void`: The function to execute. `deltaTime` is the time in seconds since the last frame.

**Example:**

```typescript
ctx.onUpdate(deltaTime => {
  // This code runs on every frame
});
```

### `onMessage(channel, callback)`

Listens for messages on a specific channel. On the client, it receives messages from the server. On the server, it receives messages from clients.

- `channel: string`: The name of the channel to listen on.
- `callback: (data: any, senderId?: string) => void`: The function to execute when a message is received. `data` is the message payload. `senderId` is the ID of the client that sent the message (only available on the server).

**Example (Client):**

```typescript
ctx.onMessage('sync-animation', data => {
  // Update animation based on server data
});
```

### `raycast(origin, direction, options?)`

Performs a raycast into the scene to detect intersections with objects.

- `origin: Vector3`: The starting point of the ray.
- `direction: Vector3`: The direction of the ray.
- `options?: RaycastOptions`: Optional parameters.
  - `maxDistance?: number`: Maximum distance for the raycast.
- **Returns**: `Hit | null`. A `Hit` object if an intersection is found, otherwise `null`.

---

## Client-Side API

These functions are only available when `ctx.isClient` is `true`.

### `spawnPrimitive(options)`

Creates and spawns a primitive 3D object into the scene.

- `options: PrimitiveOptions`: An object specifying the primitive's properties.
  - `type`: `'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'`
  - `position?`, `rotation?`, `scale?`: `Vector3`
  - `color?`: `number` (e.g., `0xff0000` for red)
  - `wireframe?`: `boolean`
- **Returns**: `SpawnedPrimitive`. An object to control the spawned primitive.

**`SpawnedPrimitive` Interface:**

- `id: string`: A unique ID for the primitive.
- `mesh: any`: The underlying `THREE.Mesh` object.
- `setPosition(position: Vector3): void`
- `setRotation(rotation: Vector3): void`
- `setScale(scale: Vector3): void`
- `destroy(): void`: Removes the primitive from the scene.

**Example:**

```typescript
const cube = ctx.spawnPrimitive({
  type: 'box',
  position: { x: 0, y: 1, z: 0 },
  color: 0x00ff00,
});

ctx.onUpdate(dt => {
  cube.setRotation({ x: 0, y: performance.now() / 1000, z: 0 });
});
```

### `sendToServer(channel, data)`

Sends a message to the server.

- `channel: string`: The channel to send the message on.
- `data: any`: The data payload to send.

**Example:**

```typescript
ctx.sendToServer('player-jump', { height: 5 });
```

### `loadModel(path)` and `loadAudio(path)`

These functions are planned for future use to load custom 3D models and audio files.

---

## Server-Side API

These functions are only available when `ctx.isServer` is `true`.

### `sendToClient(channel, data, playerId?)`

Sends a message to one or all clients.

- `channel: string`: The channel to send the message on.
- `data: any`: The data payload to send.
- `playerId?: string`: The ID of the specific client to send the message to. If omitted, the message is broadcast to all clients in the room.

**Example:**

```typescript
// Send to all clients
ctx.sendToClient('world-event', { eventName: 'meteor-shower' });

// Send to a specific client
ctx.onMessage('request-state', (data, senderId) => {
  ctx.sendToClient('initial-state', { ... }, senderId);
});
```

### `broadcast(message)`

An alias for `sendToClient` to all clients. (Note: The provided example script uses `sendToClient` without a `playerId` for broadcasting).

### `db` (Database API)

Provides methods to interact with the project's database, typically for player data.

- `db.addCurrency(userId, amount): Promise<void>`
- `db.getCurrency(userId): Promise<number>`
- `db.getUser(userId): Promise<{ id: string; name: string } | null>`

**Example:**

```typescript
ctx.onMessage('enemy-defeated', async (data, senderId) => {
  if (senderId) {
    await ctx.db.addCurrency(senderId, 100); // Give 100 coins
  }
});
```

## Full Example: Synchronized Animation

Here is an example from `scripts/example.ts` that shows how to synchronize an object's animation between the server and clients.

**Server (`scripts/example.ts`)**

```typescript
// Server controls the animation state
let animationTime = 0;
const animationSpeed = 1;

ctx.onUpdate((deltaTime: number) => {
  animationTime += deltaTime * animationSpeed;

  // Broadcast animation state to all clients every frame
  if (ctx.sendToClient) {
    ctx.sendToClient('sync-animation', {
      time: animationTime,
    });
  }
});
```

**Client (`scripts/example.ts`)**

```typescript
// Spawn the primitive to be animated
const cube = ctx.spawnPrimitive({
  type: 'box',
  position: { x: 2, y: 2, z: 0 },
});

// Listen for animation updates from server
ctx.onMessage('sync-animation', data => {
  const rotationY = data.time;
  cube.setRotation({ x: 0, y: rotationY, z: 0 });
});
```
