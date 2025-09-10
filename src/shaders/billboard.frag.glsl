uniform sampler2D map;
varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  if (texColor.a < 0.1) discard; // Alpha test for pixel-perfect transparency
  gl_FragColor = texColor;
}