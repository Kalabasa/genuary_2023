precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D paintTex;

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;
  
  vec4 paint = texture2D(paintTex, uv);
  paint.rgb = pow(paint.rgb, vec3(1.0 + pow(paint.a, 8.0)))
    * (1.0 - pow(max(0.0, paint.a - 0.25), 4.0));
  gl_FragColor = paint;
}
