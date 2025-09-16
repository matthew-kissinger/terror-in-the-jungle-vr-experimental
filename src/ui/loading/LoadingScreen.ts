import * as THREE from 'three';
import { LOADING_PHASES } from '../../config/loading';
import { LoadingStyles } from './LoadingStyles';
import { LoadingPanels } from './LoadingPanels';
import { LoadingProgress } from './LoadingProgress';

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

  // Refactored modules
  private panels: LoadingPanels;
  private progress: LoadingProgress;

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

    // Initialize modules
    this.panels = new LoadingPanels();
    this.progress = new LoadingProgress(
      this.progressFill,
      this.percentText,
      this.phaseText,
      this.tipText
    );

    this.initializePhases();
    this.setupEventListeners();
    this.progress.initializeTips();
  }

  private createLoadingScreen(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'loading-screen';
    container.innerHTML = `
      <style>${LoadingStyles.getStyles()}</style>

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
    for (const phase of LOADING_PHASES) {
      this.progress.addPhase(phase.id, phase.weight, phase.label);
    }
  }

  private setupEventListeners(): void {
    this.playButton.addEventListener('click', () => {
      if (this.onPlayCallback) {
        this.onPlayCallback();
      }
    });

    this.settingsButton.addEventListener('click', () => {
      this.panels.showSettingsPanel();
    });

    this.howToPlayButton.addEventListener('click', () => {
      this.panels.showHowToPlayPanel();
    });
  }

  public updateProgress(phaseId: string, progress: number): void {
    this.progress.updateProgress(phaseId, progress);
  }

  public setPhaseComplete(phaseId: string): void {
    this.progress.setPhaseComplete(phaseId);
  }

  public showMainMenu(): void {
    // Hide loading bar and show menu buttons
    const buttons = this.container.querySelector('.menu-buttons');
    if (buttons) {
      buttons.classList.add('visible');
    }
    this.progress.showComplete();
  }

  public hide(): void {
    // Hide immediately with fade
    this.container.classList.add('hidden');
    setTimeout(() => {
      this.isVisible = false;
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
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.panels.dispose();
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
      const currentPhase = this.progress.getCurrentPhase();
      if (currentPhase === 'textures' || url.includes('.png') || url.includes('.jpg')) {
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