import { World } from '@motionjs/common';
import { Renderer } from '../rendering/Renderer';
import { NetworkManager } from '../networking/NetworkManager';
import { PlayerController } from './PlayerController';
import { PlayerAvatar } from './PlayerAvatar';
import { CameraController } from './CameraController';
import { ClientPrediction } from './ClientPrediction';
import { ScriptLoader } from '../scripting/ScriptLoader';
import { useGameStore } from '../store/gameStore';

export class Game {
  private renderer!: Renderer;
  private networkManager: NetworkManager;
  private playerController: PlayerController;
  private cameraController!: CameraController;
  private prediction: ClientPrediction;
  private scriptLoader!: ScriptLoader;
  private world: World;

  private avatars: Map<string, PlayerAvatar> = new Map();
  private localAvatar: PlayerAvatar | null = null;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private avatarsBeingCreated: Set<string> = new Set();
  private isUpdatingFromSnapshot: boolean = false;

  constructor(private container: HTMLElement) {
    this.world = new World();
    this.networkManager = new NetworkManager('ws://localhost:8080');
    this.playerController = new PlayerController();
    this.prediction = new ClientPrediction();
  }

  private setupStoreSubscriptions(): void {
    useGameStore.subscribe(state => {
      if (state.latestSnapshot && !this.isUpdatingFromSnapshot) {
        this.updateFromSnapshot();
      }
    });
  }

  async joinRoom(roomId?: string): Promise<void> {
    try {
      // Initialize renderer and related components when actually joining
      this.renderer = new Renderer(this.container);
      this.cameraController = new CameraController(this.renderer.camera);
      this.scriptLoader = new ScriptLoader(this.world, this.renderer);
      this.scriptLoader.setNetworkManager(this.networkManager);
      this.setupStoreSubscriptions();

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

    // Update scripts
    if (this.scriptLoader) {
      this.scriptLoader.update();
    }
  }

  private async updateFromSnapshot(): Promise<void> {
    // Prevent concurrent updates
    if (this.isUpdatingFromSnapshot) return;
    this.isUpdatingFromSnapshot = true;

    try {
      const store = useGameStore.getState();
      const snapshot = store.latestSnapshot;
      if (!snapshot) return;

      // Create avatars for new players
      for (const [playerId, player] of store.players) {
        // Check both if avatar exists and if it's being created
        if (!this.avatars.has(playerId) && !this.avatarsBeingCreated.has(playerId)) {
          // Mark this avatar as being created to prevent duplicates
          this.avatarsBeingCreated.add(playerId);
          
          const isLocal = playerId === store.playerId;
          
          try {
            const avatar = await PlayerAvatar.create(player, isLocal);
            
            // Double-check avatar wasn't created while we were waiting
            if (!this.avatars.has(playerId)) {
              this.avatars.set(playerId, avatar);
              this.renderer.scene.add(avatar.vrm.scene);

              if (isLocal) {
                this.localAvatar = avatar;
                this.scriptLoader.setLocalPlayerId(playerId);
              }
            } else {
              // Avatar was created by another call, dispose this duplicate
              avatar.dispose();
            }
          } catch (error) {
            console.error(`Failed to create avatar for player ${playerId}:`, error);
          } finally {
            // Remove from being created set
            this.avatarsBeingCreated.delete(playerId);
          }
        }
      }

      // Remove avatars for players who left
      for (const [playerId, avatar] of this.avatars) {
        if (!store.players.has(playerId)) {
          this.renderer.scene.remove(avatar.vrm.scene);
          avatar.dispose();
          this.avatars.delete(playerId);

          if (playerId === store.playerId) {
            this.localAvatar = null;
          }
        }
      }

      // Reconcile local player prediction
      if (store.playerId && this.localAvatar) {
        const serverPlayer = store.players.get(store.playerId);
        if (serverPlayer) {
          this.prediction.reconcile(serverPlayer, snapshot.frameId);
        }
      }
    } finally {
      this.isUpdatingFromSnapshot = false;
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

    for (const avatar of this.avatars.values()) {
      avatar.dispose();
    }

    this.avatarsBeingCreated.clear();
    this.isUpdatingFromSnapshot = false;

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
