precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D paintTex;
uniform sampler2D waterTex;
uniform vec2 texelSize;
uniform float sigma2;

const float radius = 24.0;

float sigmoid(float x) {
  return 1.0 / (1.0 + exp(-x));
}

float max3(vec3 v) {
  return max(max(v.x, v.y), v.z);
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;
  
  vec4 dstPaint = texture2D(paintTex, uv);
  float dstWater = texture2D(waterTex, uv).r;
  vec4 outPaint = vec4(0.0);
  float totalWeight = 0.0;
  float netFlow = 0.0;

  for (float y = -radius; y <= radius; y++) {
    for (float x = -radius; x <= radius; x++) {
      vec2 sampleUv = uv + vec2(x, y) * texelSize;
      vec4 srcPaint = texture2D(paintTex, sampleUv);
      float srcWater = texture2D(waterTex, sampleUv).r;
      float flow = srcWater - dstWater + max3(srcPaint.rgb - dstPaint.rgb);
      float spread = 0.01 + sigma2 * srcWater * dstWater;
      float weight = exp(-(x * x + y * y) / spread);
      outPaint += vec4(vec3(srcPaint.rgb * srcPaint.rgb), 1.0) * srcPaint.a * weight;
      totalWeight += weight;
      netFlow += flow * pow(weight, 2.0);
    }
  }

  outPaint.rgb /= outPaint.a;
  outPaint.rgb = sqrt(outPaint.rgb);
  outPaint.a += netFlow;
  outPaint.a /= totalWeight;

  gl_FragColor = outPaint;
}
