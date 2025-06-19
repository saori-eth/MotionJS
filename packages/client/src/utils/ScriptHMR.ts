import { Game } from "../game/Game";

export class ScriptHMR {
  private game: Game | null = null;
  private isSetup: boolean = false;
  private lastReloadTime: number = 0;
  private readonly RELOAD_COOLDOWN = 1000; // 1 second cooldown between reloads

  setGame(game: Game): void {
    this.game = game;
    this.setupHMR();
  }

  private async performReload(source: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastReloadTime < this.RELOAD_COOLDOWN) {
      console.log(`⏳ Script reload rate limited (${source}), skipping...`);
      return;
    }

    this.lastReloadTime = now;

    if (this.game) {
      console.log(`🔄 Script reload triggered by: ${source}`);
      console.log("🎮 Game state before reload:", {
        isReloadingScripts: this.game.isReloadingScripts(),
        timestamp: new Date().toISOString(),
      });

      try {
        await this.game.reloadScripts();
        console.log("✅ Script reload completed successfully");
        this.showReloadNotification("✅ Scripts reloaded successfully!");
      } catch (error) {
        console.error("❌ Script reload failed:", error);
        this.showReloadNotification(
          "❌ Script reload failed - check console",
          true
        );
      }
    }
  }

  private setupHMR(): void {
    if (this.isSetup || !import.meta.hot) {
      return;
    }

    this.isSetup = true;
    console.log("🔥 Script HMR enabled");

    // Listen for our custom script-changed events from the Vite plugin
    import.meta.hot.on("script-changed", async (data) => {
      await this.performReload(`file change: ${data.file}`);
    });

    // Keep this module alive and prevent it from being reloaded
    import.meta.hot.accept();

    // Listen for custom script reload events from the game itself
    window.addEventListener("scriptsReloaded", () => {
      this.showReloadNotification("✅ Scripts reloaded successfully!");
    });

    window.addEventListener("scriptsReloadError", (event: any) => {
      this.showReloadNotification(
        "❌ Script reload failed - check console",
        true
      );
    });

    // Add manual reload shortcut (Ctrl/Cmd + Shift + R)
    window.addEventListener("keydown", async (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.code === "KeyR"
      ) {
        event.preventDefault();
        await this.performReload("manual keyboard shortcut");
      }
    });

    console.log(
      "💡 Tip: Press Ctrl/Cmd + Shift + R to manually reload scripts"
    );
  }

  private showReloadNotification(
    message: string,
    isError: boolean = false
  ): void {
    // Create a temporary notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${isError ? "#ff4444" : "#44aa44"};
      color: white;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateX(100%);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateX(0)";
    });

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
}

export const scriptHMR = new ScriptHMR();
