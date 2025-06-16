import { ScriptContext } from "@motionjs/common";

export default async function exampleScript(ctx: ScriptContext) {
  console.log(`Example script loaded on ${ctx.isClient ? "client" : "server"}`);

  // Create a ticker entity
  const tickEntity = ctx.world.createEntity("ticker");
  tickEntity.addComponent("ticker", {
    interval: 1000,
    lastTick: Date.now(),
    totalTime: 0,
  });

  // Register an update callback that runs every frame
  ctx.onUpdate((deltaTime: number) => {
    const entities = ctx.world.queryByComponents("ticker");

    for (const entity of entities) {
      const ticker = entity.getComponent<any>("ticker");
      const now = Date.now();
      ticker.totalTime += deltaTime;

      if (now - ticker.lastTick >= ticker.interval) {
        ticker.lastTick = now;

        if (ctx.isServer && ctx.db) {
          console.log(`Server tick! Total time: ${ticker.totalTime.toFixed(2)}s`);
        } else if (ctx.isClient) {
          console.log(`Client tick! Total time: ${ticker.totalTime.toFixed(2)}s`);
        }
      }
    }
  });

  // Example of frame-based updates
  if (ctx.isClient) {
    // Rotate an entity smoothly on the client
    const rotatingEntity = ctx.world.createEntity("rotator");
    rotatingEntity.addComponent("rotation", {
      speed: Math.PI, // radians per second
      angle: 0,
    });

    ctx.onUpdate((deltaTime: number) => {
      const rotation = rotatingEntity.getComponent<any>("rotation");
      rotation.angle += rotation.speed * deltaTime;
      // In a real scenario, you'd update the visual representation here
    });
  }
}
