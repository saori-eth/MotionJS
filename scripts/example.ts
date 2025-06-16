import { ScriptContext } from "@motionjs/common";

export default async function exampleScript(ctx: ScriptContext) {
  console.log(`Example script loaded on ${ctx.isClient ? "client" : "server"}`);

  // Server-controlled synchronized animation
  if (ctx.isServer) {
    // Server controls the animation state
    let animationTime = 0;
    const animationSpeed = 1; // 1 rotation per second

    ctx.onUpdate((deltaTime: number) => {
      animationTime += deltaTime * animationSpeed;
      
      // Broadcast animation state to all clients every frame
      if (ctx.sendToClient) {
        ctx.sendToClient('sync-animation', {
          time: animationTime,
          objects: [
            { id: 'cube', rotation: animationTime },
            { id: 'torus', rotationX: animationTime * 0.5, rotationY: animationTime * 1.5 },
            { id: 'sphere', y: Math.sin(animationTime * 2) * 0.5 + 3 }
          ]
        });
      }
    });

    // Handle client requests for current state
    ctx.onMessage('request-animation-state', (data, senderId) => {
      if (ctx.sendToClient && senderId) {
        ctx.sendToClient('sync-animation', {
          time: animationTime,
          objects: [
            { id: 'cube', rotation: animationTime },
            { id: 'torus', rotationX: animationTime * 0.5, rotationY: animationTime * 1.5 },
            { id: 'sphere', y: Math.sin(animationTime * 2) * 0.5 + 3 }
          ]
        }, senderId);
      }
    });
  }

  // Client-side: spawn primitives and sync with server animation
  if (ctx.isClient && ctx.spawnPrimitive) {
    // Spawn synchronized primitives
    const cube = ctx.spawnPrimitive({
      type: 'box',
      position: { x: 2, y: 2, z: 0 },
      color: 0xff0000,
      scale: { x: 1.5, y: 1.5, z: 1.5 }
    });

    const torus = ctx.spawnPrimitive({
      type: 'torus',
      position: { x: -2, y: 2, z: 0 },
      color: 0x0000ff,
    });

    const sphere = ctx.spawnPrimitive({
      type: 'sphere',
      position: { x: 0, y: 3, z: -2 },
      color: 0x00ff00,
    });

    // Map to store primitives by ID
    const primitives: Record<string, any> = {
      'cube': cube,
      'torus': torus,
      'sphere': sphere
    };

    // Listen for animation updates from server
    ctx.onMessage('sync-animation', (data) => {
      if (data.objects) {
        for (const obj of data.objects) {
          const primitive = primitives[obj.id];
          if (primitive) {
            if (obj.id === 'cube') {
              primitive.setRotation({ x: 0, y: obj.rotation, z: 0 });
            } else if (obj.id === 'torus') {
              primitive.setRotation({ x: obj.rotationX, y: obj.rotationY, z: 0 });
            } else if (obj.id === 'sphere') {
              primitive.setPosition({ x: 0, y: obj.y, z: -2 });
            }
          }
        }
      }
    });

    // Request initial state when joining
    if (ctx.sendToServer) {
      ctx.sendToServer('request-animation-state', {});
    }

    // Example of client-only animation: wireframe cone that spins locally
    const cone = ctx.spawnPrimitive({
      type: 'cone',
      position: { x: 0, y: 2, z: 2 },
      color: 0xffff00,
      wireframe: true,
    });

    let localTime = 0;
    ctx.onUpdate((deltaTime: number) => {
      localTime += deltaTime;
      // This cone spins locally, not synced with server
      cone.setRotation({ x: 0, y: 0, z: localTime * 2 });
    });

    // Example of player interaction
    ctx.onMessage('player-action', (data) => {
      console.log('Received player action:', data);
    });

    // Destroy cone after 10 seconds
    setTimeout(() => {
      console.log("Destroying cone after 10 seconds");
      cone.destroy();
    }, 10000);
  }
}
