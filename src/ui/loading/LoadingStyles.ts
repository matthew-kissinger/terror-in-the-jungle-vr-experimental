export class LoadingStyles {
  static getStyles(): string {
    return `
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
    `;
  }
}