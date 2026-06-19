#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_plateTex;
uniform sampler2D u_elevTex;
uniform sampler2D u_moistTex;
uniform sampler2D u_riverTex;
uniform sampler2D u_tempTex;
uniform sampler2D u_selectMask;

uniform int u_style;
uniform float u_seaLevel;
uniform float u_time;
uniform float u_mapWidth;
uniform float u_mapHeight;
uniform float u_lightAngle;
uniform int u_showBoundaries;
uniform float u_boundaryWidth;
uniform vec3 u_boundaryColor;
uniform int u_showRivers;
uniform int u_showContours;
uniform float u_contourInterval;
uniform int u_showTerrain;
uniform int u_showSelection;
uniform int u_showClimate;
uniform int u_showGrid;
uniform int u_showElevScale;
uniform int u_glowEnabled;
uniform int u_pointLightEnabled;
uniform vec2 u_pointLightPos;
uniform float u_pointLightIntensity;
uniform vec3 u_pointLightColor;

const vec3 OCEAN_DEEP = vec3(0.05, 0.15, 0.35);
const vec3 OCEAN_SHALLOW = vec3(0.15, 0.35, 0.55);
const vec3 SAND = vec3(0.75, 0.7, 0.5);
const vec3 GRASS = vec3(0.35, 0.6, 0.25);
const vec3 FOREST = vec3(0.15, 0.45, 0.15);
const vec3 ROCK = vec3(0.55, 0.5, 0.45);
const vec3 SNOW = vec3(0.95, 0.95, 1.0);
const vec3 DESERT = vec3(0.85, 0.75, 0.45);
const vec3 TUNDRA = vec3(0.75, 0.85, 0.85);
const vec3 ICE = vec3(0.9, 0.95, 1.0);
const vec3 RIVER = vec3(0.25, 0.45, 0.65);
const vec3 LAKE = vec3(0.3, 0.5, 0.7);

vec3 getTerrainColor(float elev, float slope, float temp, float moist) {
  if (elev <= u_seaLevel) {
    float t = elev / u_seaLevel;
    return mix(OCEAN_DEEP, OCEAN_SHALLOW, t);
  }
  float land = (elev - u_seaLevel) / (1.0 - u_seaLevel);
  if (land < 0.05) return SAND;
  if (temp < 0.15) return mix(TUNDRA, ICE, 0.5 - temp * 2.0);
  if (moist < 0.2 && temp > 0.5) return DESERT;
  if (elev > 0.7) return mix(ROCK, SNOW, (elev - 0.7) * 3.33);
  if (elev > 0.5) return mix(GRASS, ROCK, (elev - 0.5) * 5.0);
  if (moist > 0.6) return FOREST;
  return GRASS;
}

vec3 getBiomeColor(float biome) {
  int b = int(biome * 8.0);
  if (b == 0) return OCEAN_SHALLOW;
  if (b == 1) return ICE;
  if (b == 2) return ROCK;
  if (b == 3) return DESERT;
  if (b == 4) return vec3(0.3, 0.5, 0.4);
  if (b == 5) return FOREST;
  if (b == 6) return TUNDRA;
  return GRASS;
}

vec3 applyLighting(vec3 color, vec3 normal, vec3 pos) {
  float lightRad = u_lightAngle * 3.14159 / 180.0;
  vec3 lightDir = normalize(vec3(cos(lightRad), sin(lightRad), 0.8));
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 lit = color * (0.4 + 0.6 * diff);

  if (u_pointLightEnabled > 0) {
    vec3 lightPos = vec3(u_pointLightPos.x, u_pointLightPos.y, 0.5);
    vec3 toLight = lightPos - pos;
    float dist = length(toLight);
    float att = 1.0 / (1.0 + dist * dist * 4.0);
    float pointDiff = max(dot(normal, normalize(toLight)), 0.0);
    lit += u_pointLightColor * u_pointLightIntensity * pointDiff * att;
  }

  if (u_glowEnabled > 0) {
    float glow = pow(1.0 - abs(v_uv.y - 0.5) * 2.0, 2.0) * 0.15;
    lit += vec3(0.4, 0.6, 0.9) * glow;
  }

  return lit;
}

vec3 computeNormal(float elev, vec2 texel) {
  float ex = texture(u_elevTex, v_uv + vec2(texel.x, 0.0)).r;
  float ey = texture(u_elevTex, v_uv + vec2(0.0, texel.y)).r;
  vec3 dx = vec3(texel.x * 2.0, 0.0, ex - elev);
  vec3 dy = vec3(0.0, texel.y * 2.0, ey - elev);
  return normalize(cross(dx, dy));
}

void main() {
  vec4 plate = texture(u_plateTex, v_uv);
  vec4 elev = texture(u_elevTex, v_uv);
  vec4 moist = texture(u_moistTex, v_uv);
  vec4 river = texture(u_riverTex, v_uv);
  vec4 temp = texture(u_tempTex, v_uv);
  vec2 texel = vec2(1.0 / u_mapWidth, 1.0 / u_mapHeight);

  float elevation = elev.r;
  float slope = elev.g;
  float ridgeMask = elev.a;
  float moisture = moist.r;
  float temperature = moist.b;
  float riverMask = river.r;
  float lakeMask = river.a;
  float biome = temp.b;

  vec3 color = vec3(0.0);
  vec3 normal = computeNormal(elevation, texel);
  vec3 pos = vec3(v_uv, elevation);

  switch (u_style) {
    case 0:
      color = getTerrainColor(elevation, slope, temperature, moisture);
      if (ridgeMask > 0.5) color = mix(color, ROCK, 0.5);
      color = applyLighting(color, normal, pos);
      break;
    case 1:
      color = mix(vec3(0.1, 0.2, 0.5), vec3(0.9, 0.95, 1.0), (elevation + 1.0) * 0.5);
      color = applyLighting(color, normal, pos);
      break;
    case 2:
      color = plate.g > 0.5 ? vec3(0.6, 0.5, 0.4) : vec3(0.2, 0.3, 0.5);
      color = applyLighting(color, normal, pos);
      break;
    case 3: {
      float t = (elevation + 1.0) * 0.5;
      color = mix(vec3(0.85, 0.75, 0.55), vec3(0.95, 0.9, 0.75), t);
      if (elevation <= u_seaLevel) color = mix(vec3(0.4, 0.5, 0.6), vec3(0.5, 0.6, 0.7), t);
      break;
    }
    case 4:
      color = getTerrainColor(elevation, slope, temperature, moisture);
      if (elevation > u_seaLevel) color = mix(color, vec3(0.9, 0.9, 0.85), 0.1);
      color = applyLighting(color, normal, pos);
      break;
    case 5:
      color = getTerrainColor(elevation, slope, temperature, moisture);
      if (slope > 0.3) color = mix(color, ROCK, 0.3);
      if (ridgeMask > 0.5) color = mix(color, SNOW, 0.4);
      color = applyLighting(color, normal, pos);
      break;
    case 6:
      color = getBiomeColor(biome);
      color = applyLighting(color, normal, pos);
      break;
    case 7: {
      float t = (elevation + 1.0) * 0.5;
      color = mix(vec3(0.9, 0.9, 0.85), vec3(0.3, 0.25, 0.2), t);
      if (u_showContours > 0) {
        float contour = fract(elevation / u_contourInterval);
        if (contour < 0.02 || contour > 0.98) {
          color = mix(color, vec3(0.2, 0.15, 0.1), 0.7);
        }
      }
      break;
    }
    case 8:
      color = vec3(0.5 + dot(normal, normalize(vec3(0.3, 0.5, 0.8))) * 0.5);
      break;
    case 9:
      color = getTerrainColor(elevation, slope, temperature, moisture);
      if (elevation <= u_seaLevel) color = mix(OCEAN_DEEP, OCEAN_SHALLOW, elevation / u_seaLevel);
      else {
        float land = (elevation - u_seaLevel) / (1.0 - u_seaLevel);
        if (land < 0.03) color = SAND;
        else if (temperature < 0.1) color = ICE;
        else if (moisture < 0.25 && temperature > 0.4) color = DESERT;
        else if (moisture > 0.65) color = FOREST;
        else color = GRASS;
        if (land > 0.6) color = mix(color, ROCK, (land - 0.6) * 2.5);
        if (land > 0.8) color = SNOW;
      }
      color = applyLighting(color, normal, pos);
      break;
  }

  if (u_showRivers > 0 && riverMask > 0.0) {
    color = mix(color, RIVER, min(riverMask * 1.5, 1.0));
  }

  if (lakeMask > 0.0) {
    color = mix(color, LAKE, 0.6);
  }

  if (u_showBoundaries > 0 && plate.b > 0.0) {
    color = mix(color, u_boundaryColor, smoothstep(0.0, u_boundaryWidth * 0.01, plate.b) * 0.8);
  }

  if (u_showSelection > 0) {
    float sel = texture(u_selectMask, vec2(plate.r, 0.5)).r;
    if (sel > 0.5) {
      color = mix(color, vec3(1.0, 0.9, 0.3), 0.3);
    }
  }

  if (u_showGrid > 0) {
    vec2 grid = fract(v_uv * 10.0);
    if (grid.x < 0.005 || grid.y < 0.005) {
      color = mix(color, vec3(0.5), 0.3);
    }
  }

  if (u_showElevScale > 0) {
    if (v_uv.x < 0.02) {
      color = mix(color, mix(vec3(0.1, 0.2, 0.5), vec3(0.9, 0.95, 1.0), v_uv.y), 0.8);
    }
  }

  outColor = vec4(color, 1.0);
}
