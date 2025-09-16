import * as THREE from 'three';
import { ImprovedChunkManager } from '../terrain/ImprovedChunkManager';

export class ZoneTerrainAdapter {
  private chunkManager?: ImprovedChunkManager;

  constructor(chunkManager?: ImprovedChunkManager) {
    this.chunkManager = chunkManager;
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  findSuitableZonePosition(desiredPosition: THREE.Vector3, searchRadius: number): THREE.Vector3 {
    if (!this.chunkManager) {
      console.error('❌ ChunkManager not available for terrain height query!');
      return new THREE.Vector3(desiredPosition.x, 0, desiredPosition.z);
    }

    let bestPosition = desiredPosition.clone();
    let bestSlope = Infinity;
    const sampleCount = 12;

    // Test the desired position first
    const centerHeight = this.chunkManager.getHeightAt(desiredPosition.x, desiredPosition.z);
    const centerSlope = this.calculateTerrainSlope(desiredPosition.x, desiredPosition.z);
    bestPosition.y = centerHeight;
    bestSlope = centerSlope;

    // Search in a spiral pattern for flatter terrain
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      const distance = searchRadius * (0.5 + Math.random() * 0.5);
      const testX = desiredPosition.x + Math.cos(angle) * distance;
      const testZ = desiredPosition.z + Math.sin(angle) * distance;

      const height = this.chunkManager.getHeightAt(testX, testZ);
      const slope = this.calculateTerrainSlope(testX, testZ);

      // Prefer flatter terrain (lower slope) and avoid water
      if (slope < bestSlope && height > -2) {
        bestSlope = slope;
        bestPosition = new THREE.Vector3(testX, height, testZ);
      }
    }

    console.log(`🚩 Zone placed at (${bestPosition.x.toFixed(1)}, ${bestPosition.y.toFixed(1)}, ${bestPosition.z.toFixed(1)}) with slope ${bestSlope.toFixed(2)}`);

    // Special handling for problematic zones (like Alpha zone)
    if (Math.abs(bestPosition.x + 120) < 10) {
      console.warn(`⚠️ Alpha zone terrain check: desired=(${desiredPosition.x}, ${desiredPosition.z}), final=(${bestPosition.x}, ${bestPosition.y}, ${bestPosition.z})`);

      if (bestPosition.y < -5 || bestPosition.y > 50) {
        console.warn(`⚠️ Alpha zone height ${bestPosition.y} seems problematic, adjusting...`);

        // Try positions closer to center
        for (let attempt = 0; attempt < 5; attempt++) {
          const testX = -80 + attempt * 10;
          const testZ = 30 + attempt * 10;
          const testHeight = this.chunkManager.getHeightAt(testX, testZ);

          if (testHeight > -2 && testHeight < 30) {
            bestPosition = new THREE.Vector3(testX, testHeight, testZ);
            console.log(`🔧 Alpha zone relocated to (${testX}, ${testHeight.toFixed(1)}, ${testZ})`);
            break;
          }
        }
      }
    }

    return bestPosition;
  }

  private calculateTerrainSlope(x: number, z: number): number {
    if (!this.chunkManager) return 0;

    const sampleDistance = 5;
    const centerHeight = this.chunkManager.getHeightAt(x, z);

    // Sample heights in 4 directions
    const northHeight = this.chunkManager.getHeightAt(x, z + sampleDistance);
    const southHeight = this.chunkManager.getHeightAt(x, z - sampleDistance);
    const eastHeight = this.chunkManager.getHeightAt(x + sampleDistance, z);
    const westHeight = this.chunkManager.getHeightAt(x - sampleDistance, z);

    // Calculate maximum height difference (slope)
    const maxDifference = Math.max(
      Math.abs(northHeight - centerHeight),
      Math.abs(southHeight - centerHeight),
      Math.abs(eastHeight - centerHeight),
      Math.abs(westHeight - centerHeight)
    );

    return maxDifference / sampleDistance;
  }

  getTerrainHeight(x: number, z: number): number {
    if (!this.chunkManager) return 0;
    return this.chunkManager.getHeightAt(x, z);
  }
}