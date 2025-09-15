export interface SoundConfig {
  path: string;
  volume?: number;
  loop?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
}

export const AUDIO_POOL_SIZES = {
  gunshot: 20,
  death: 10
} as const;

export const SOUND_CONFIGS: Record<string, SoundConfig> = {
  playerGunshot: {
    path: 'assets/optimized/playerGunshot.wav',
    volume: 0.7
  },
  otherGunshot: {
    path: 'assets/optimized/otherGunshot.wav',
    volume: 0.6,
    refDistance: 10,
    maxDistance: 100,
    rolloffFactor: 1.5
  },
  allyDeath: {
    path: 'assets/optimized/AllyDeath.wav',
    volume: 0.8,
    refDistance: 5,
    maxDistance: 50,
    rolloffFactor: 2
  },
  enemyDeath: {
    path: 'assets/optimized/EnemyDeath.wav',
    volume: 0.8,
    refDistance: 5,
    maxDistance: 50,
    rolloffFactor: 2
  },
  jungle1: {
    path: 'assets/optimized/jungle1.ogg',
    volume: 0.3,
    loop: true
  },
  jungle2: {
    path: 'assets/optimized/jungle2.ogg',
    volume: 0.25,
    loop: true
  }
};
