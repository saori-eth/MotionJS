# MotionJS

A lightweight 3D multiplayer game engine built with TypeScript, Three.js, and WebSockets.

## Features

- **Monorepo Architecture**: Client, server, and shared packages
- **Authoritative Server**: Server-side physics with client prediction
- **ECS System**: Flexible entity-component-system for game logic
- **Isomorphic Scripts**: Write once, run on both client and server
- **Built-in Physics**: Cannon.js physics engine integration
- **Currency System**: SQLite-backed player currency management
- **Hot Reloading**: Development mode with automatic reloading

## Quick Start

```bash
# Install dependencies
pnpm install

# Build common package
pnpm -C packages/common build

# Start development servers
pnpm dev
```

This will start:

- Client dev server at http://localhost:3000
- Game server at ws://localhost:8080

## Project Structure

```
motionjs/
├── packages/
│   ├── client/      # Vite + Three.js client
│   ├── server/      # Node.js + WebSocket server
│   └── common/      # Shared types and ECS
├── scripts/         # Game scripts (run on both client/server)
└── package.json     # Root workspace config
```

## Writing Scripts

Scripts are TypeScript files in the `/scripts` directory that export a default function:

```typescript
import { ScriptContext } from '@motionjs/common';

export default async function myScript(ctx: ScriptContext) {
  // Access the ECS world
  const entity = ctx.world.createEntity();

  // Check environment
  if (ctx.isServer) {
    // Server-only code
    await ctx.db?.addCurrency(playerId, 100);
  } else if (ctx.isClient) {
    // Client-only code
    const model = await ctx.loadModel?.('/assets/model.glb');
  }

  // Raycast (works on both sides)
  const hit = ctx.raycast(origin, direction);
}
```

## Architecture

- **Client**: Renders the game world, handles input, performs prediction
- **Server**: Authoritative physics, game state, and currency management
- **Common**: Shared ECS, types, and networking protocols

The client performs local prediction for player movement and reconciles with server snapshots. Non-player entities are interpolated from server state.

## Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
```
