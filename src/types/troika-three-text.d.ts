declare module 'troika-three-text' {
  import { Mesh, BufferGeometry, Material } from 'three';

  export class Text extends Mesh {
    constructor();
    text: string;
    font: string;
    fontSize: number;
    color: number | string;
    anchorX: 'left' | 'center' | 'right' | number;
    anchorY: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | number;
    maxWidth: number;
    lineHeight: number;
    letterSpacing: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    material: Material;
    sync(): void;
    dispose(): void;
  }
}