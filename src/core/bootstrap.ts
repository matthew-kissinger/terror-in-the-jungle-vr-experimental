import { PixelArtSandbox } from './PixelArtSandbox';

export function bootstrapGame(): void {
  const sandbox = new PixelArtSandbox();
  sandbox.start();

  window.addEventListener('beforeunload', () => {
    sandbox.dispose();
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      sandbox.dispose();
    });
  }
}
