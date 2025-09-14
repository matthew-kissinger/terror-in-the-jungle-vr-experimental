import * as THREE from 'three';

interface LoadingPhase {
  name: string;
  weight: number;
  progress: number;
  status: 'pending' | 'loading' | 'complete';
}

interface LoadingTip {
  text: string;
  category: 'controls' | 'gameplay' | 'lore' | 'tips';
}

export class LoadingScreen {
  private container: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private percentText: HTMLSpanElement;
  private phaseText: HTMLDivElement;
  private tipText: HTMLDivElement;
  private playButton: HTMLButtonElement;
  private settingsButton: HTMLButtonElement;
  private howToPlayButton: HTMLButtonElement;
  private settingsPanel: HTMLDivElement;
  private howToPlayPanel: HTMLDivElement;
  private transitionOverlay: HTMLDivElement;

  private phases: Map<string, LoadingPhase> = new Map();
  private currentPhase: string = '';
  private totalProgress: number = 0;
  private startTime: number = Date.now();

  private tips: LoadingTip[] = [
    // Controls
    { text: "Use WASD to move and SHIFT to sprint", category: 'controls' },
    { text: "Right-click to aim down sights for better accuracy", category: 'controls' },
    { text: "Press ESC to release mouse lock", category: 'controls' },

    // Gameplay
    { text: "Capture zones to drain enemy tickets", category: 'gameplay' },
    { text: "Stay with your squad for better survival", category: 'gameplay' },
    { text: "Headshots deal 70% more damage", category: 'gameplay' },
    { text: "Different vegetation provides different levels of cover", category: 'gameplay' },
    { text: "Listen for enemy gunfire to locate threats", category: 'gameplay' },

    // Lore
    { text: "The jungle remembers everything...", category: 'lore' },
    { text: "US Forces vs OPFOR - Who will control the zones?", category: 'lore' },
    { text: "Dense foliage can hide both friend and foe", category: 'lore' },

    // Tips
    { text: "Flank enemies for tactical advantage", category: 'tips' },
    { text: "Control high ground for better visibility", category: 'tips' },
    { text: "Suppressive fire keeps enemies pinned", category: 'tips' }
  ];

  private currentTipIndex: number = 0;
  private lastTipTime: number = Date.now();
  private tipRotationInterval: number = 3000; // 3 seconds

  private isVisible: boolean = true;
  private onPlayCallback?: () => void;
  private onSettingsCallback?: () => void;
  private onHowToPlayCallback?: () => void;

  constructor() {
    this.container = this.createLoadingScreen();
    this.progressBar = this.container.querySelector('.loading-bar') as HTMLDivElement;
    this.progressFill = this.container.querySelector('.progress-fill') as HTMLDivElement;
    this.percentText = this.container.querySelector('.percent-text') as HTMLSpanElement;
    this.phaseText = this.container.querySelector('.phase-text') as HTMLDivElement;
    this.tipText = this.container.querySelector('.tip-text') as HTMLDivElement;
    this.playButton = this.container.querySelector('.play-button') as HTMLButtonElement;
    this.settingsButton = this.container.querySelector('.settings-button') as HTMLButtonElement;
    this.howToPlayButton = this.container.querySelector('.how-to-play-button') as HTMLButtonElement;
    this.settingsPanel = this.createSettingsPanel();
    this.howToPlayPanel = this.createHowToPlayPanel();
    this.transitionOverlay = this.createTransitionOverlay();

    this.initializePhases();
    this.setupEventListeners();
    this.showNextTip();
  }

  private createLoadingScreen(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'loading-screen';
    container.innerHTML = `
      <style>
        #loading-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a2f1a 0%, #0d1a0d 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: 'Courier New', monospace;
          color: #c4b5a0;
          transition: opacity 0.5s ease-out;
        }

        .loading-content {
          text-align: center;
          max-width: 600px;
          padding: 20px;
        }

        .game-title {
          font-size: 48px;
          font-weight: bold;
          color: #8fbc8f;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
          margin-bottom: 10px;
          letter-spacing: 2px;
          animation: pulse 2s ease-in-out infinite;
        }

        .subtitle {
          font-size: 18px;
          color: #708070;
          margin-bottom: 40px;
          font-style: italic;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .loading-bar {
          width: 100%;
          height: 30px;
          background: rgba(0,0,0,0.5);
          border: 2px solid #4a5a4a;
          border-radius: 15px;
          overflow: hidden;
          position: relative;
          margin: 20px 0;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2d4a2b 0%, #4a7c4e 50%, #2d4a2b 100%);
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
          transition: width 0.3s ease-out;
          border-radius: 13px;
          box-shadow: 0 0 10px rgba(74, 124, 78, 0.5);
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .percent-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 16px;
          font-weight: bold;
          color: #fff;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        }

        .phase-text {
          font-size: 14px;
          color: #8fbc8f;
          margin: 10px 0;
          height: 20px;
          opacity: 0.9;
        }

        .tip-container {
          margin-top: 30px;
          padding: 15px;
          background: rgba(0,0,0,0.3);
          border-left: 3px solid #4a7c4e;
          border-radius: 5px;
          min-height: 50px;
        }

        .tip-label {
          font-size: 12px;
          color: #708070;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .tip-text {
          font-size: 14px;
          color: #c4b5a0;
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .menu-buttons {
          display: none;
          flex-direction: column;
          gap: 15px;
          margin-top: 40px;
          align-items: center;
        }

        .menu-buttons.visible {
          display: flex;
        }

        .menu-button {
          padding: 15px 40px;
          font-size: 18px;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          background: linear-gradient(135deg, #2d4a2b 0%, #4a7c4e 100%);
          color: #fff;
          border: 2px solid #4a7c4e;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          min-width: 200px;
        }

        .menu-button:hover {
          background: linear-gradient(135deg, #4a7c4e 0%, #5a8c5e 100%);
          border-color: #5a8c5e;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(74, 124, 78, 0.3);
        }

        .menu-button:active {
          transform: translateY(0);
        }

        .play-button {
          font-size: 24px;
          padding: 20px 60px;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(74, 124, 78, 0.5); }
          50% { box-shadow: 0 0 30px rgba(74, 124, 78, 0.8); }
        }

        .secondary-button {
          font-size: 14px;
          padding: 10px 30px;
          background: rgba(0,0,0,0.5);
          border-color: #708070;
        }

        .secondary-button:hover {
          background: rgba(74, 124, 78, 0.2);
        }

        .loading-stats {
          position: absolute;
          bottom: 20px;
          left: 20px;
          font-size: 10px;
          color: #708070;
          opacity: 0.5;
        }

        #loading-screen.hidden {
          opacity: 0;
          pointer-events: none;
        }
      </style>

      <div class="loading-content">
        <h1 class="game-title">TERROR IN THE JUNGLE</h1>
        <div class="subtitle">US Forces vs OPFOR</div>

        <div class="loading-bar">
          <div class="progress-fill" style="width: 0%"></div>
          <span class="percent-text">0%</span>
        </div>

        <div class="phase-text">Initializing...</div>

        <div class="tip-container">
          <div class="tip-label">TIP</div>
          <div class="tip-text"></div>
        </div>

        <div class="menu-buttons">
          <button class="menu-button play-button">PLAY</button>
          <button class="menu-button secondary-button settings-button">SETTINGS</button>
          <button class="menu-button secondary-button how-to-play-button">HOW TO PLAY</button>
        </div>
      </div>

      <div class="loading-stats">
        <span class="load-time"></span>
      </div>
    `;

    document.body.appendChild(container);
    return container;
  }

  private initializePhases(): void {
    // Define loading phases with weights
    this.addPhase('core', 0.1, 'Initializing core systems');
    this.addPhase('textures', 0.4, 'Loading textures');
    this.addPhase('audio', 0.2, 'Loading audio');
    this.addPhase('world', 0.2, 'Generating world');
    this.addPhase('entities', 0.1, 'Spawning entities');
  }

  private addPhase(id: string, weight: number, name: string): void {
    this.phases.set(id, {
      name,
      weight,
      progress: 0,
      status: 'pending'
    });
  }

  private setupEventListeners(): void {
    this.playButton.addEventListener('click', () => {
      if (this.onPlayCallback) {
        this.startGameTransition();
        // Give transition time to play before starting game
        setTimeout(() => {
          if (this.onPlayCallback) this.onPlayCallback();
        }, 500);
      }
    });

    this.settingsButton.addEventListener('click', () => {
      this.showSettingsPanel();
    });

    this.howToPlayButton.addEventListener('click', () => {
      this.showHowToPlayPanel();
    });

    // Close panels when clicking outside
    this.settingsPanel.addEventListener('click', (e) => {
      if (e.target === this.settingsPanel) {
        this.hideSettingsPanel();
      }
    });

    this.howToPlayPanel.addEventListener('click', (e) => {
      if (e.target === this.howToPlayPanel) {
        this.hideHowToPlayPanel();
      }
    });
  }

  public updateProgress(phaseId: string, progress: number): void {
    const phase = this.phases.get(phaseId);
    if (!phase) return;

    // Update phase
    phase.progress = Math.min(1, Math.max(0, progress));
    phase.status = progress >= 1 ? 'complete' : 'loading';

    // Update current phase text
    if (phase.status === 'loading') {
      this.currentPhase = phaseId;
      this.phaseText.textContent = phase.name + '...';
    }

    // Calculate total progress
    let total = 0;
    this.phases.forEach(p => {
      total += p.progress * p.weight;
    });
    this.totalProgress = Math.min(1, total);

    // Update UI
    const percent = Math.floor(this.totalProgress * 100);
    this.progressFill.style.width = `${percent}%`;
    this.percentText.textContent = `${percent}%`;

    // Rotate tips
    if (Date.now() - this.lastTipTime > this.tipRotationInterval) {
      this.showNextTip();
    }

    // Update load time
    const loadTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const statsEl = this.container.querySelector('.load-time');
    if (statsEl) {
      statsEl.textContent = `Load time: ${loadTime}s`;
    }
  }

  private showNextTip(): void {
    this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
    const tip = this.tips[this.currentTipIndex];

    this.tipText.style.animation = 'none';
    setTimeout(() => {
      this.tipText.textContent = tip.text;
      this.tipText.style.animation = 'fadeIn 0.5s ease-in';
    }, 50);

    this.lastTipTime = Date.now();
  }

  public setPhaseComplete(phaseId: string): void {
    this.updateProgress(phaseId, 1);
  }

  public showMainMenu(): void {
    // Hide loading bar and show menu buttons
    const buttons = this.container.querySelector('.menu-buttons');
    if (buttons) {
      buttons.classList.add('visible');
    }

    this.phaseText.textContent = 'Ready to play!';
    this.progressFill.style.width = '100%';
    this.percentText.textContent = '100%';
  }

  public hide(): void {
    // Don't hide immediately - transition handles it
    setTimeout(() => {
      this.container.classList.add('hidden');
      this.isVisible = false;
    }, 1500);
  }

  private createSettingsPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 10001;
      justify-content: center;
      align-items: center;
    `;

    panel.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a2f1a 0%, #0d1a0d 100%);
        border: 2px solid #4a7c4e;
        border-radius: 10px;
        padding: 30px;
        max-width: 500px;
        color: #c4b5a0;
        font-family: 'Courier New', monospace;
      ">
        <h2 style="color: #8fbc8f; margin-bottom: 20px;">SETTINGS</h2>

        <div style="margin: 15px 0;">
          <label style="display: block; margin-bottom: 5px;">Graphics Quality</label>
          <select style="width: 100%; padding: 5px; background: rgba(0,0,0,0.5); color: #c4b5a0; border: 1px solid #4a7c4e;">
            <option>Low</option>
            <option selected>Medium</option>
            <option>High</option>
            <option>Ultra</option>
          </select>
        </div>

        <div style="margin: 15px 0;">
          <label style="display: block; margin-bottom: 5px;">Master Volume</label>
          <input type="range" min="0" max="100" value="70" style="width: 100%;">
        </div>

        <div style="margin: 15px 0;">
          <label style="display: block; margin-bottom: 5px;">Mouse Sensitivity</label>
          <input type="range" min="1" max="10" value="5" style="width: 100%;">
        </div>

        <div style="margin: 15px 0;">
          <label>
            <input type="checkbox" checked> Show FPS Counter
          </label>
        </div>

        <div style="margin: 15px 0;">
          <label>
            <input type="checkbox" checked> Enable Shadows
          </label>
        </div>

        <button class="close-settings" style="
          margin-top: 20px;
          padding: 10px 30px;
          background: linear-gradient(135deg, #2d4a2b 0%, #4a7c4e 100%);
          color: white;
          border: 2px solid #4a7c4e;
          border-radius: 5px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
        ">CLOSE</button>
      </div>
    `;

    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('.close-settings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideSettingsPanel());
    }

    return panel;
  }

  private createHowToPlayPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'how-to-play-panel';
    panel.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 10001;
      justify-content: center;
      align-items: center;
      overflow-y: auto;
    `;

    panel.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a2f1a 0%, #0d1a0d 100%);
        border: 2px solid #4a7c4e;
        border-radius: 10px;
        padding: 30px;
        max-width: 600px;
        color: #c4b5a0;
        font-family: 'Courier New', monospace;
        margin: 20px;
      ">
        <h2 style="color: #8fbc8f; margin-bottom: 20px;">HOW TO PLAY</h2>

        <h3 style="color: #708070; margin-top: 20px;">CONTROLS</h3>
        <ul style="list-style: none; padding: 0;">
          <li>⌨️ WASD - Move</li>
          <li>⌨️ SHIFT - Sprint</li>
          <li>⌨️ SPACE - Jump</li>
          <li>🖱️ MOUSE - Look around</li>
          <li>🖱️ LEFT CLICK - Fire weapon</li>
          <li>🖱️ RIGHT CLICK - Aim down sights</li>
          <li>⌨️ ESC - Release mouse lock</li>
        </ul>

        <h3 style="color: #708070; margin-top: 20px;">OBJECTIVE</h3>
        <p>Capture and hold zones to drain enemy tickets. The team that runs out of tickets first loses!</p>

        <h3 style="color: #708070; margin-top: 20px;">ZONES</h3>
        <p>Stand in neutral or enemy zones to capture them. More teammates in a zone = faster capture!</p>

        <h3 style="color: #708070; margin-top: 20px;">COMBAT TIPS</h3>
        <ul style="list-style: none; padding: 0;">
          <li>🎯 Headshots deal 70% more damage</li>
          <li>🌲 Use vegetation for cover</li>
          <li>👂 Listen for enemy gunfire</li>
          <li>🏃 Stay mobile to avoid being hit</li>
        </ul>

        <button class="close-how-to-play" style="
          margin-top: 20px;
          padding: 10px 30px;
          background: linear-gradient(135deg, #2d4a2b 0%, #4a7c4e 100%);
          color: white;
          border: 2px solid #4a7c4e;
          border-radius: 5px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
        ">CLOSE</button>
      </div>
    `;

    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('.close-how-to-play');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideHowToPlayPanel());
    }

    return panel;
  }

  private createTransitionOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 10002;
      display: none;
      pointer-events: none;
    `;

    // Add scanline effect
    overlay.innerHTML = `
      <div class="scanlines" style="
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
          0deg,
          rgba(0,255,0,0.03),
          rgba(0,255,0,0.03) 1px,
          transparent 1px,
          transparent 2px
        );
        pointer-events: none;
        animation: scanlines 8s linear infinite;
      "></div>
      <style>
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(10px); }
        }
        @keyframes glitchDistortion {
          0%, 100% { transform: scaleX(1) scaleY(1); filter: blur(0px); }
          20% { transform: scaleX(1.02) scaleY(0.98); filter: blur(1px); }
          40% { transform: scaleX(0.98) scaleY(1.01); filter: blur(0.5px); }
          60% { transform: scaleX(1.01) scaleY(0.99); filter: blur(1.5px); }
          80% { transform: scaleX(0.99) scaleY(1.02); filter: blur(0.8px); }
        }
        .transition-active {
          animation: glitchDistortion 0.8s ease-out;
        }
      </style>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  private showSettingsPanel(): void {
    this.settingsPanel.style.display = 'flex';
  }

  private hideSettingsPanel(): void {
    this.settingsPanel.style.display = 'none';
  }

  private showHowToPlayPanel(): void {
    this.howToPlayPanel.style.display = 'flex';
  }

  private hideHowToPlayPanel(): void {
    this.howToPlayPanel.style.display = 'none';
  }

  private startGameTransition(): void {
    // Simple fade to black transition
    this.transitionOverlay.style.display = 'block';
    this.transitionOverlay.style.opacity = '0';
    this.transitionOverlay.style.transition = 'opacity 0.3s ease-in';

    // Fade to black
    setTimeout(() => {
      this.transitionOverlay.style.opacity = '1';
    }, 10);

    // Add glitch effect to loading screen
    this.container.style.transition = 'filter 0.3s ease-out';
    this.container.style.filter = 'blur(5px) brightness(1.5)';

    // After transition completes, fade back from black
    setTimeout(() => {
      this.transitionOverlay.style.transition = 'opacity 0.8s ease-out';
      this.transitionOverlay.style.opacity = '0';
      setTimeout(() => {
        this.transitionOverlay.style.display = 'none';
      }, 800);
    }, 500);
  }

  public show(): void {
    this.container.classList.remove('hidden');
    this.isVisible = true;
  }

  public onPlay(callback: () => void): void {
    this.onPlayCallback = callback;
  }

  public onSettings(callback: () => void): void {
    this.onSettingsCallback = callback;
  }

  public onHowToPlay(callback: () => void): void {
    this.onHowToPlayCallback = callback;
  }

  public dispose(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    if (this.settingsPanel && this.settingsPanel.parentElement) {
      this.settingsPanel.parentElement.removeChild(this.settingsPanel);
    }
    if (this.howToPlayPanel && this.howToPlayPanel.parentElement) {
      this.howToPlayPanel.parentElement.removeChild(this.howToPlayPanel);
    }
    if (this.transitionOverlay && this.transitionOverlay.parentElement) {
      this.transitionOverlay.parentElement.removeChild(this.transitionOverlay);
    }
  }

  // Helper method for LoadingManager integration
  public createLoadingManager(): THREE.LoadingManager {
    const manager = new THREE.LoadingManager();

    let itemsLoaded = 0;
    let itemsTotal = 0;

    manager.onStart = (url, loaded, total) => {
      itemsLoaded = loaded;
      itemsTotal = total;
      console.log(`Loading started: ${loaded}/${total} items`);
    };

    manager.onProgress = (url, loaded, total) => {
      itemsLoaded = loaded;
      itemsTotal = total;

      // Update texture loading phase
      if (this.currentPhase === 'textures' || url.includes('.png') || url.includes('.jpg')) {
        this.updateProgress('textures', loaded / total);
      } else if (url.includes('.wav') || url.includes('.ogg')) {
        this.updateProgress('audio', loaded / total);
      }

      console.log(`Loading: ${url} (${loaded}/${total})`);
    };

    manager.onLoad = () => {
      console.log('All items loaded!');
    };

    manager.onError = (url) => {
      console.error(`Error loading: ${url}`);
    };

    return manager;
  }
}