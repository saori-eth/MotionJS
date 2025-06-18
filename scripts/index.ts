import { ScriptContext } from "@motionjs/common";
import {
  createAnimationObjects,
  createPrimitiveConfigs,
  updatePrimitiveFromAnimation,
  spawnPrimitivesFromConfigs,
  AnimationObject,
} from "./helper";

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
        ctx.sendToClient("sync-animation", {
          time: animationTime,
          objects: createAnimationObjects(animationTime),
        });
      }
    });

    // Handle client requests for current state
    ctx.onMessage("request-animation-state", (data, senderId) => {
      if (ctx.sendToClient && senderId) {
        ctx.sendToClient(
          "sync-animation",
          {
            time: animationTime,
            objects: createAnimationObjects(animationTime),
          },
          senderId
        );
      }
    });
  }

  // Client-side: spawn primitives and sync with server animation
  if (ctx.isClient && ctx.spawnPrimitive) {
    // Spawn synchronized primitives using helper functions
    const primitiveConfigs = createPrimitiveConfigs();
    const primitives = spawnPrimitivesFromConfigs(
      ctx.spawnPrimitive,
      primitiveConfigs
    );

    // Listen for animation updates from server
    ctx.onMessage("sync-animation", (data) => {
      if (data.objects) {
        for (const obj of data.objects) {
          const primitive = primitives[obj.id];
          if (primitive) {
            updatePrimitiveFromAnimation(primitive, obj);
          }
        }
      }
    });

    // Request initial state when joining
    if (ctx.sendToServer) {
      ctx.sendToServer("request-animation-state", {});
    }

    // Example of client-only animation: wireframe cone that spins locally
    const cone = ctx.spawnPrimitive({
      type: "cone",
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
    ctx.onMessage("player-action", (data) => {
      console.log("Received player action:", data);
    });

    // Destroy cone after 10 seconds
    setTimeout(() => {
      console.log("Destroying cone after 10 seconds");
      cone.destroy();
    }, 10000);
  }
}
