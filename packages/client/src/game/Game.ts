import { World } from '@motionjs/common';
import { Renderer } from '../rendering/Renderer';
import { NetworkManager } from '../networking/NetworkManager';
import { ScriptLoader } from '../scripting/ScriptLoader';
import { useGameStore } from '../store/gameStore';
import { world as ecsWorld, GameWorld } from '../ecs/world';
import { System } from 'bitecs';
import {
  createInputSystem,
  createClientPredictionSystem,
  createMovementSystem,
  createInterpolationSystem,
  createAnimationSystem,
  createCameraSystem,
  createRenderingSystem,
  createNetworkSystem,
  createPhysicsSystem
} from '../ecs/systems';

export class Game {
  private renderer!: Renderer;
  private networkManager: NetworkManager;
  private scriptLoader!: ScriptLoader;
  private world: World;
  private ecsWorld: GameWorld;
  private systems: System<[], GameWorld>[] = [];

  private animationId: number | null = null;
  private lastTime: number = 0;

  constructor(private container: HTMLElement) {
    this.world = new World();
    this.ecsWorld = ecsWorld;
    this.networkManager = new NetworkManager('ws://localhost:8080');
  }

  private setupStoreSubscriptions(): void {
    // NetworkSystem now handles snapshot updates
    /*
    useGameStore.subscribe(state => {
      if (state.latestSnapshot && !this.isUpdatingFromSnapshot) {
        this.updateFromSnapshot();
      }
    });
    */
  }
  
  private initializeSystems(): void {
    // Create systems in the correct order
    this.systems = [
      createNetworkSystem(this.networkManager, this.renderer),
      createInputSystem(this.networkManager),
      createClientPredictionSystem(),
      createPhysicsSystem(), // Physics must run before movement
      createMovementSystem(),
      createInterpolationSystem(),
      createAnimationSystem(),
      createCameraSystem(this.renderer.camera),
      createRenderingSystem()
    ];
  }

  async joinRoom(roomId?: string): Promise<void> {
    try {
      // Initialize renderer and related components when actually joining
      this.renderer = new Renderer(this.container);
      this.scriptLoader = new ScriptLoader(this.world, this.renderer);
      this.scriptLoader.setNetworkManager(this.networkManager);
      this.setupStoreSubscriptions();
      
      // Initialize ECS systems
      this.initializeSystems();

      await this.networkManager.connect();
      this.networkManager.joinRoom(roomId, 'Player');
      this.start();
      await this.scriptLoader.loadScripts();
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  }

  private start(): void {
    this.lastTime = performance.now();
    this.animate();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.renderer.render();
  };

  private update(deltaTime: number): void {
    // Update ECS world time
    this.ecsWorld.time.delta = deltaTime;
    this.ecsWorld.time.elapsed += deltaTime;

    // Run ECS systems pipeline
    for (const system of this.systems) {
      system(this.ecsWorld);
    }

    // OLD LOGIC - TO BE REMOVED AFTER FULL MIGRATION
    /*
    const store = useGameStore.getState();

    if (store.playerId && this.localAvatar) {
      const input = this.playerController.getInput(deltaTime);

      if (this.playerController.isMoving() && this.networkManager.isConnected()) {
        this.networkManager.sendInput(input);
        this.prediction.addInput(input);
      }

      // Don't predict position for now - let server update handle it

      this.cameraController.follow(this.localAvatar.vrm.scene, deltaTime);

      // Update spawn position tracking for reconnection
      const pos = this.localAvatar.vrm.scene.position;
      this.networkManager.setSpawnPosition({ x: pos.x, y: pos.y, z: pos.z });
    }

    // Update all avatars from server state
    for (const [id, avatar] of this.avatars) {
      const player = store.players.get(id);
      if (player) {
        avatar.updateFromPlayer(player, deltaTime);
      }
    }
    */

    // Update scripts
    if (this.scriptLoader) {
      this.scriptLoader.update();
    }
  }


  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.networkManager.disconnect();

    if (this.renderer) {
      this.renderer.dispose();
    }

    useGameStore.getState().reset();
  }

  /**
   * Reload scripts without disrupting the game session
   */
  async reloadScripts(): Promise<void> {
    if (!this.scriptLoader) {
      console.warn('ScriptLoader not initialized, cannot reload scripts');
      return;
    }

    try {
      // Store current game state to detect if anything gets corrupted
      const wasRendering = !!this.animationId;

      await this.scriptLoader.reloadScripts();

      // Verify core systems are still working after reload
      if (wasRendering && !this.animationId) {
        console.warn('⚠️ Animation loop stopped after script reload, restarting...');
        this.start();
      }
    } catch (error) {
      console.error('❌ Game: Failed to reload scripts:', error);

      // Don't let script errors break the game - continue running
      console.log('🔧 Game: Continuing normal operation despite script reload failure');
    }
  }

  /**
   * Check if scripts are currently reloading
   */
  isReloadingScripts(): boolean {
    return this.scriptLoader ? this.scriptLoader.isReloadingScripts() : false;
  }
}
