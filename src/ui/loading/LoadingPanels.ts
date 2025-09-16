export class LoadingPanels {
  private settingsPanel: HTMLDivElement;
  private howToPlayPanel: HTMLDivElement;
  private transitionOverlay: HTMLDivElement;

  constructor() {
    this.settingsPanel = this.createSettingsPanel();
    this.howToPlayPanel = this.createHowToPlayPanel();
    this.transitionOverlay = this.createTransitionOverlay();
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

    // Close on background click
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        this.hideSettingsPanel();
      }
    });

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

    // Close on background click
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        this.hideHowToPlayPanel();
      }
    });

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
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  showSettingsPanel(): void {
    this.settingsPanel.style.display = 'flex';
  }

  hideSettingsPanel(): void {
    this.settingsPanel.style.display = 'none';
  }

  showHowToPlayPanel(): void {
    this.howToPlayPanel.style.display = 'flex';
  }

  hideHowToPlayPanel(): void {
    this.howToPlayPanel.style.display = 'none';
  }

  startGameTransition(container: HTMLDivElement): void {
    this.transitionOverlay.style.display = 'block';
    this.transitionOverlay.style.opacity = '0';
    this.transitionOverlay.style.transition = 'opacity 0.3s ease-in';

    setTimeout(() => {
      this.transitionOverlay.style.opacity = '1';
    }, 10);

    container.style.transition = 'filter 0.3s ease-out';
    container.style.filter = 'blur(5px) brightness(1.5)';

    setTimeout(() => {
      this.transitionOverlay.style.transition = 'opacity 0.8s ease-out';
      this.transitionOverlay.style.opacity = '0';
      setTimeout(() => {
        this.transitionOverlay.style.display = 'none';
      }, 800);
    }, 500);
  }

  dispose(): void {
    if (this.settingsPanel?.parentElement) {
      this.settingsPanel.parentElement.removeChild(this.settingsPanel);
    }
    if (this.howToPlayPanel?.parentElement) {
      this.howToPlayPanel.parentElement.removeChild(this.howToPlayPanel);
    }
    if (this.transitionOverlay?.parentElement) {
      this.transitionOverlay.parentElement.removeChild(this.transitionOverlay);
    }
  }
}