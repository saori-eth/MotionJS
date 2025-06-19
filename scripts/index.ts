import { ScriptContext } from '@motionjs/common';
import {
  createAnimationObjects,
  createPrimitiveConfigs,
  updatePrimitiveFromAnimation,
  spawnPrimitivesFromConfigs,
  AnimationObject,
} from './helper';

/**
 * 🔥 HOT RELOAD ENABLED! 🔥
 *
 * This script supports hot reloading during development:
 * - Edit this file or helper.ts and see changes instantly
 * - No need to restart the game or return to homescreen
 * - Use Ctrl/Cmd + Shift + R for manual reload
 * - Watch the console and notifications for reload status
 *
 * Note: Script-spawned objects will be cleanly disposed and recreated,
 * but your player position and network connection will be preserved.
 */

export default async function exampleScript(ctx: ScriptContext) {
  console.log(`Example script loaded on ${ctx.isClient ? 'client' : 'server'}`);

  // Server-controlled synchronized animation
  if (ctx.isServer) {
    // Server controls the animation state
    let animationTime = 0;
    const animationSpeed = 2; // 1 rotation per second

    ctx.onUpdate((deltaTime: number) => {
      animationTime += deltaTime * animationSpeed;

      // Broadcast animation state to all clients every frame
      if (ctx.sendToClient) {
        ctx.sendToClient('sync-animation', {
          time: animationTime,
          objects: createAnimationObjects(animationTime),
        });
      }
    });

    // Handle client requests for current state
    ctx.onMessage('request-animation-state', (data, senderId) => {
      console.log(`📡 Server: Received animation state request from ${senderId || 'unknown'}`);
      if (ctx.sendToClient && senderId) {
        ctx.sendToClient(
          'sync-animation',
          {
            time: animationTime,
            objects: createAnimationObjects(animationTime),
          },
          senderId
        );
        console.log(`📤 Server: Sent current animation state to ${senderId}`);
      }
    });
  }

  // Client-side: spawn primitives and sync with server animation
  if (ctx.isClient && ctx.spawnPrimitive) {
    // Spawn synchronized primitives using helper functions
    const primitiveConfigs = createPrimitiveConfigs();
    const primitives = spawnPrimitivesFromConfigs(ctx.spawnPrimitive, primitiveConfigs);

    // Track if we've received initial state
    let hasInitialState = false;
    let hasRequestedState = false;

    // Listen for animation updates from server
    ctx.onMessage('sync-animation', data => {
      try {
        if (data.objects) {
          hasInitialState = true;
          for (const obj of data.objects) {
            const primitive = primitives[obj.id];
            if (primitive) {
              updatePrimitiveFromAnimation(primitive, obj);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error handling sync-animation message:', error);
      }
    });

    // Request initial state when joining (or after script reload) - but only once
    if (ctx.sendToServer && !hasRequestedState) {
      try {
        hasRequestedState = true;
        console.log('🔄 Requesting initial animation state from server...');
        ctx.sendToServer('request-animation-state', {});

        // If we don't receive state within 3 seconds, request again (for script reload cases)
        setTimeout(() => {
          if (!hasInitialState && ctx.sendToServer) {
            console.log("🔄 Re-requesting animation state (didn't receive initial state)...");
            try {
              ctx.sendToServer('request-animation-state', {});
            } catch (error) {
              console.error('❌ Error re-requesting animation state:', error);
            }
          }
        }, 3000); // Increased from 2000ms to 3000ms
      } catch (error) {
        console.error('❌ Error requesting initial animation state:', error);
      }
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
    ctx.onMessage('player-action', data => {
      console.log('Received player action:', data);
    });

    // Destroy cone after 10 seconds
    setTimeout(() => {
      console.log('Destroying cone after 10 seconds');
      cone.destroy();
    }, 10000);

    // Slowly rotate the test cube
    let testTime = 0;
    ctx.onUpdate((deltaTime: number) => {
      testTime += deltaTime;
    });
  }
}
