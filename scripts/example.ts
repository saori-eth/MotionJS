import { ScriptContext } from "@motionjs/common";

export default async function exampleScript(ctx: ScriptContext) {
  console.log(`Example script loaded on ${ctx.isClient ? "client" : "server"}`);

  const tickEntity = ctx.world.createEntity("ticker");
  tickEntity.addComponent("ticker", {
    interval: 1000,
    lastTick: Date.now(),
  });

  setInterval(() => {
    const entities = ctx.world.queryByComponents("ticker");

    for (const entity of entities) {
      const ticker = entity.getComponent<any>("ticker");
      const now = Date.now();

      if (now - ticker.lastTick >= ticker.interval) {
        ticker.lastTick = now;

        if (ctx.isServer && ctx.db) {
          console.log("Server tick!");
        } else if (ctx.isClient) {
          console.log("Client tick!");
        }
      }
    }
  }, 100);
}
