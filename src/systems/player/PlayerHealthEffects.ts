import * as THREE from 'three';

export interface DamageIndicator {
  direction: number;
  intensity: number;
  timestamp: number;
  fadeTime: number;
}

export class PlayerHealthEffects {
  private damageIndicators: DamageIndicator[] = [];
  private damageOverlay: HTMLCanvasElement;
  private damageContext: CanvasRenderingContext2D;

  // Audio for heartbeat effect
  private audioContext?: AudioContext;
  private heartbeatGain?: GainNode;
  private isPlayingHeartbeat = false;

  constructor() {
    this.damageOverlay = document.createElement('canvas');
    this.damageOverlay.className = 'damage-overlay';
    this.damageOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 150;
    `;

    this.damageContext = this.damageOverlay.getContext('2d')!;
    this.setupAudio();
  }

  private setupAudio(): void {
    try {
      this.audioContext = new AudioContext();
      this.heartbeatGain = this.audioContext.createGain();
      this.heartbeatGain.connect(this.audioContext.destination);
      this.heartbeatGain.gain.value = 0;
    } catch (e) {
      console.warn('Audio context not available for heartbeat effect');
    }
  }

  init(): void {
    document.body.appendChild(this.damageOverlay);
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Add damage flash animation styles
    const damageFlashStyle = document.createElement('style');
    damageFlashStyle.textContent = `
      @keyframes damageFlash {
        0% { filter: brightness(1); }
        50% { filter: brightness(1.5) saturate(0.5) hue-rotate(-10deg); }
        100% { filter: brightness(1); }
      }
    `;
    document.head.appendChild(damageFlashStyle);
  }

  private resizeCanvas(): void {
    this.damageOverlay.width = window.innerWidth;
    this.damageOverlay.height = window.innerHeight;
  }

  addDamageIndicator(
    amount: number,
    sourcePosition?: THREE.Vector3,
    playerPosition?: THREE.Vector3
  ): void {
    if (sourcePosition && playerPosition) {
      const direction = new THREE.Vector3()
        .subVectors(sourcePosition, playerPosition)
        .normalize();

      // Convert to screen angle
      const screenAngle = Math.atan2(direction.z, direction.x);

      this.damageIndicators.push({
        direction: screenAngle,
        intensity: Math.min(1.0, amount / 50),
        timestamp: Date.now(),
        fadeTime: 2.0
      });
    }

    // Screen flash effect
    this.triggerDamageFlash();
  }

  private triggerDamageFlash(): void {
    document.body.style.animation = 'none';
    setTimeout(() => {
      document.body.style.animation = 'damageFlash 0.2s ease';
      setTimeout(() => {
        document.body.style.animation = 'none';
      }, 200);
    }, 10);
  }

  updateDamageIndicators(deltaTime: number): void {
    // Remove expired indicators
    this.damageIndicators = this.damageIndicators.filter(indicator => {
      const age = (Date.now() - indicator.timestamp) / 1000;
      return age < indicator.fadeTime;
    });
  }

  renderDamageOverlay(health: number, maxHealth: number): void {
    this.damageContext.clearRect(0, 0, this.damageOverlay.width, this.damageOverlay.height);

    // Render damage indicators
    this.damageIndicators.forEach(indicator => {
      const age = (Date.now() - indicator.timestamp) / 1000;
      const alpha = Math.max(0, (indicator.fadeTime - age) / indicator.fadeTime);

      this.damageContext.save();
      this.damageContext.globalAlpha = alpha * indicator.intensity;

      // Draw directional damage indicator
      const centerX = this.damageOverlay.width / 2;
      const centerY = this.damageOverlay.height / 2;
      const distance = Math.min(centerX, centerY) * 0.8;

      const x = centerX + Math.cos(indicator.direction) * distance;
      const y = centerY + Math.sin(indicator.direction) * distance;

      // Draw arrow pointing to damage source
      this.damageContext.fillStyle = '#ff4444';
      this.damageContext.beginPath();
      this.damageContext.arc(x, y, 10 * indicator.intensity, 0, Math.PI * 2);
      this.damageContext.fill();

      // Draw line to edge
      this.damageContext.strokeStyle = '#ff4444';
      this.damageContext.lineWidth = 3 * indicator.intensity;
      this.damageContext.beginPath();
      this.damageContext.moveTo(centerX, centerY);
      this.damageContext.lineTo(x, y);
      this.damageContext.stroke();

      this.damageContext.restore();
    });

    // Red screen edge effect when low health
    if (health < 30) {
      const intensity = (30 - health) / 30;
      this.damageContext.save();
      this.damageContext.globalAlpha = intensity * 0.3;

      // Draw red vignette
      const gradient = this.damageContext.createRadialGradient(
        this.damageOverlay.width / 2,
        this.damageOverlay.height / 2,
        0,
        this.damageOverlay.width / 2,
        this.damageOverlay.height / 2,
        Math.max(this.damageOverlay.width, this.damageOverlay.height) / 2
      );
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 1)');

      this.damageContext.fillStyle = gradient;
      this.damageContext.fillRect(0, 0, this.damageOverlay.width, this.damageOverlay.height);
      this.damageContext.restore();
    }
  }

  startHeartbeat(): void {
    if (!this.audioContext || this.isPlayingHeartbeat) return;

    this.isPlayingHeartbeat = true;
    const playHeartbeat = () => {
      if (!this.isPlayingHeartbeat || !this.audioContext || !this.heartbeatGain) return;

      // Create heartbeat sound using oscillator
      const osc = this.audioContext.createOscillator();
      const envelope = this.audioContext.createGain();

      osc.connect(envelope);
      envelope.connect(this.heartbeatGain);

      osc.frequency.setValueAtTime(80, this.audioContext.currentTime);
      osc.type = 'sine';

      envelope.gain.setValueAtTime(0, this.audioContext.currentTime);
      envelope.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
      envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.3);

      // Schedule next heartbeat
      setTimeout(playHeartbeat, 800);
    };

    playHeartbeat();
  }

  stopHeartbeat(): void {
    this.isPlayingHeartbeat = false;
  }

  clearDamageIndicators(): void {
    this.damageIndicators = [];
  }

  dispose(): void {
    this.stopHeartbeat();
    if (this.damageOverlay.parentNode) {
      this.damageOverlay.parentNode.removeChild(this.damageOverlay);
    }
  }
}