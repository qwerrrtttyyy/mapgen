#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_plateTex;
uniform sampler2D u_elevTex;
uniform sampler2D u_moistureTex;
uniform sampler2D u_tempTex;
uniform sampler2D u_riverTex;
uniform sampler2D u_selectionMaskTex;
uniform sampler2D u_trailTex;
uniform int u_style;
uniform float u_seaLevel;
uniform float u_lightAngle;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_showBoundaries;
uniform float u_boundaryWidth;
uniform vec3 u_boundaryColor;
uniform float u_pointLightEnabled;
uniform vec2 u_pointLightPos;
uniform float u_pointLightIntensity;
uniform vec3 u_pointLightColor;
uniform float u_glowEnabled;
uniform vec2 u_laserStart;
uniform vec2 u_laserEnd;
uniform float u_laserActive;
uniform float u_laserWidth;
uniform float u_laserSelection;
uniform vec3 u_laserColor;
uniform float u_hasTrail;
uniform int u_selectedCount;
uniform int u_plateTotal;
uniform int u_fbmOctaves;
uniform float u_fbmLacunarity;
uniform float u_fbmPersistence;
uniform float u_snowLine;
uniform float u_erosionStrength;
uniform float u_showRivers;
uniform float u_contourInterval;
uniform float u_showContours;
uniform float u_showTerrain;
uniform float u_showSelection;
uniform float u_showClimate;
uniform vec2 u_cursorPos;
uniform float u_cursorActive;
uniform float u_cursorSize;
uniform float u_detailRiverWidth;
uniform float u_detailRiverCurve;
uniform float u_detailCoastJagged;
uniform float u_detailRidgeDensity;
uniform float u_detailRainfallOffset;
uniform float u_detailTempGradient;
uniform float u_detailBiomeBlend;
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbmNoise(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 8; i++) {
        if (i >= u_fbmOctaves) break;
        v += a * vnoise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}
vec3 terrainColor(float h, float sea, float moisture) {
    vec3 col;
    if (h < sea - 0.3) {
        float t = clamp((h - (sea - 0.6)) / 0.3, 0.0, 1.0);
        col = mix(vec3(0.02, 0.06, 0.22), vec3(0.06, 0.18, 0.55), t);
    }
    else if (h < sea - 0.05) {
        float t = clamp((h - (sea - 0.3)) / 0.25, 0.0, 1.0);
        col = mix(vec3(0.06, 0.18, 0.55), vec3(0.10, 0.45, 0.70), t);
    }
    else if (h < sea) {
        float t = clamp((h - (sea - 0.05)) / 0.05, 0.0, 1.0);
        col = mix(vec3(0.10, 0.45, 0.70), vec3(0.90, 0.82, 0.58), t);
    }
    else if (h < sea + 0.012) {
        col = vec3(0.90, 0.82, 0.58);
    }
    else if (h < sea + 0.15) {
        float t = clamp((h - sea - 0.012) / 0.138, 0.0, 1.0);
        vec3 grass = mix(vec3(0.28, 0.65, 0.18), vec3(0.18, 0.48, 0.12), moisture);
        col = mix(vec3(0.90, 0.82, 0.58), grass, t);
    }
    else if (h < sea + 0.30) {
        float t = clamp((h - sea - 0.15) / 0.15, 0.0, 1.0);
        col = mix(vec3(0.18, 0.48, 0.12), vec3(0.45, 0.35, 0.18), t);
    }
    else if (h < sea + 0.55) {
        float t = clamp((h - sea - 0.30) / 0.25, 0.0, 1.0);
        col = mix(vec3(0.45, 0.35, 0.18), vec3(0.55, 0.50, 0.48), t);
    }
    else {
        float t = clamp((h - sea - 0.55) / 0.45, 0.0, 1.0);
        col = mix(vec3(0.55, 0.50, 0.48), vec3(0.95, 0.95, 0.98), t);
    }
    float microVar = (vnoise(v_uv * 200.0) - 0.5) * 0.04;
    col = col * (1.0 + microVar);
    return col;
}
vec3 platesColor(float plateId, float elev, float sea, float shade) {
    float hue = fract(plateId * 0.618033988749895 + 0.05);
    vec3 col = elev < sea ? hsv2rgb(vec3(hue, 0.55, 0.75)) : hsv2rgb(vec3(hue, 0.50, 0.95));
    return col * mix(0.75, 1.05, shade);
}
vec3 parchmentColor(float h, float sea, float boundary, float plateType) {
    vec3 paper = mix(vec3(.88, .78, .58), vec3(.82, .72, .52), fbmNoise(v_uv * 8.0));
    paper = mix(paper, paper * 0.75, smoothstep(0.62, 0.68, fbmNoise(v_uv * 12.0 + 50.0)) * 0.4);
    float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));
    paper = mix(paper, vec3(.3, .18, .08), smoothstep(0.08, 0.0, edgeDist) * 0.8);
    vec3 ink;
    if (h < sea) ink = mix(vec3(.45, .55, .65), vec3(.25, .35, .50), sea > 0.001 ? (sea - h) / sea : 0.0);
    else ink = mix(vec3(.6, .55, .35), vec3(.45, .35, .2), (h - sea) / (1.0 - sea + 0.001));
    vec3 col = mix(paper, ink, 0.72);
    if (u_showBoundaries > 0.5 && boundary > u_boundaryWidth * 0.1) col = mix(col, vec3(.45, .15, .08), boundary * 0.85);
    col *= mix(0.6, 1.0, smoothstep(0.0, 0.7, 1.0 - length((v_uv - 0.5) * 1.3))); return col;
}
float hillshade(vec2 uv, float lightAng) {
    vec2 tx = 1.0 / u_resolution;
    float hTL = texture(u_elevTex, uv + vec2(-tx.x,  tx.y)).r;
    float hTC = texture(u_elevTex, uv + vec2( 0.0,   tx.y)).r;
    float hTR = texture(u_elevTex, uv + vec2( tx.x,  tx.y)).r;
    float hML = texture(u_elevTex, uv + vec2(-tx.x,  0.0)).r;
    float hMR = texture(u_elevTex, uv + vec2( tx.x,  0.0)).r;
    float hBL = texture(u_elevTex, uv + vec2(-tx.x, -tx.y)).r;
    float hBC = texture(u_elevTex, uv + vec2( 0.0,  -tx.y)).r;
    float hBR = texture(u_elevTex, uv + vec2( tx.x, -tx.y)).r;
    float dhdx = (hTR + 2.0 * hMR + hBR) - (hTL + 2.0 * hML + hBL);
    float dhdy = (hBL + 2.0 * hBC + hBR) - (hTL + 2.0 * hTC + hTR);
    vec3 normal = normalize(vec3(dhdx, dhdy, 0.06));
    vec3 lightDir = normalize(vec3(cos(lightAng), sin(lightAng), 0.6));
    return clamp(dot(normal, lightDir), 0.15, 1.0);
}
vec3 terrainDetailColor(float h, float sea, float moisture, float river, float shade) {
    vec3 col = terrainColor(h, sea, moisture);
    if (u_showRivers > 0.5 && river > 0.0 && h >= sea) {
        vec3 riverCol = mix(vec3(0.15, 0.35, 0.55), vec3(0.20, 0.50, 0.70), river);
        col = mix(col, riverCol, river * 0.7);
    }
    if (h >= sea) {
        float veg = moisture * (1.0 - smoothstep(sea + 0.3, sea + 0.55, h));
        col = mix(col, col * vec3(0.85, 1.1, 0.8), veg * 0.3);
    }
    col *= shade;
    return col;
}
vec3 biomeColor(float temp, float moist, float h, float sea, float shade) {
    if (h < sea) {
        float t = clamp((h - (sea - 0.3)) / 0.3, 0.0, 1.0);
        return mix(vec3(0.02, 0.06, 0.22), vec3(0.10, 0.45, 0.70), t) * shade;
    }
    vec3 col;
    float ht = (h - sea) / (1.0 - sea + 0.001);
    if (temp > 0.7 && moist > 0.55) {
        col = mix(vec3(0.08, 0.35, 0.06), vec3(0.05, 0.25, 0.04), ht);
    }
    else if (temp > 0.7 && moist <= 0.55) {
        col = mix(vec3(0.65, 0.62, 0.28), vec3(0.55, 0.50, 0.22), ht);
    }
    else if (temp > 0.6 && moist < 0.2) {
        col = mix(vec3(0.85, 0.78, 0.52), vec3(0.75, 0.65, 0.40), ht);
    }
    else if (temp > 0.35 && moist > 0.5) {
        col = mix(vec3(0.15, 0.50, 0.10), vec3(0.10, 0.38, 0.08), ht);
    }
    else if (temp > 0.35 && moist <= 0.5) {
        col = mix(vec3(0.50, 0.60, 0.25), vec3(0.42, 0.50, 0.20), ht);
    }
    else if (temp > 0.15) {
        col = mix(vec3(0.45, 0.52, 0.38), vec3(0.55, 0.55, 0.50), ht);
    }
    else {
        col = mix(vec3(0.82, 0.88, 0.90), vec3(0.95, 0.97, 1.0), ht);
    }
    float snowH = u_snowLine;
    if (ht > snowH) {
        float snowT = clamp((ht - snowH) / 0.15, 0.0, 1.0);
        col = mix(col, vec3(0.95, 0.95, 0.98), snowT);
    }
    float microVar = (vnoise(v_uv * 150.0) - 0.5) * 0.03;
    col = col * (1.0 + microVar);
    if (u_showClimate > 0.5 && h >= sea) {
        float tempGrad = length(vec2(dFdx(temp), dFdy(temp))) * u_detailTempGradient;
        float moistGrad = length(vec2(dFdx(moist), dFdy(moist)));
        float boundary = smoothstep(0.01, 0.04, tempGrad + moistGrad);
        col = mix(col, vec3(1.0, 0.95, 0.4), boundary * 0.5);
    }
    return col * shade;
}
vec3 contourColor(float h, float sea, float shade) {
    if (u_showContours < 0.5) return terrainColor(h, sea, 0.5) * shade;
    vec3 col = terrainColor(h, sea, 0.5);
    float interval = u_contourInterval * 0.01;
    float contourFrac = fract(h / interval);
    float contourLine = 1.0 - smoothstep(0.02, 0.05, contourFrac) * smoothstep(0.0, 0.02, contourFrac);
    float majorFrac = fract(h / (interval * 5.0));
    float majorLine = 1.0 - smoothstep(0.015, 0.04, majorFrac) * smoothstep(0.0, 0.015, majorFrac);
    float fill = floor(h / interval) * interval;
    vec3 fillColor = terrainColor(fill + interval * 0.5, sea, 0.5);
    col = mix(col, fillColor, 0.15);
    if (h >= sea) {
        col = mix(col, vec3(0.25, 0.20, 0.15), contourLine * 0.5);
        col = mix(col, vec3(0.15, 0.12, 0.08), majorLine * 0.7);
    }
    col *= shade;
    return col;
}
vec3 reliefColor(float h, float sea, float shade) {
    vec3 col = terrainColor(h, sea, 0.5);
    float enhanced = pow(shade, 0.7);
    vec2 tx = 1.0 / u_resolution;
    float hC = texture(u_elevTex, v_uv).r;
    float ao = 0.0;
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
            if (dx == 0 && dy == 0) continue;
            float hN = texture(u_elevTex, v_uv + vec2(float(dx), float(dy)) * tx * 2.0).r;
            if (hN > hC) ao += (hN - hC) * 0.3;
        }
    }
    ao = clamp(1.0 - ao, 0.5, 1.0);
    col *= enhanced * ao;
    col = pow(col, vec3(0.9));
    return col;
}
// 图层可视化风格 (style 10-16)
vec3 layerElevation(float h, float sea) {
    // 灰度高程图，海平面以下蓝色
    if (h < sea) {
        float t = clamp((h - (sea - 0.6)) / 0.6, 0.0, 1.0);
        return mix(vec3(0.02, 0.04, 0.15), vec3(0.08, 0.22, 0.45), t);
    }
    float t = (h - sea) / (1.0 - sea + 0.001);
    // 热力图配色：深绿→黄→橙→红→白
    vec3 c1 = vec3(0.1, 0.35, 0.1);
    vec3 c2 = vec3(0.3, 0.6, 0.15);
    vec3 c3 = vec3(0.85, 0.75, 0.25);
    vec3 c4 = vec3(0.85, 0.35, 0.12);
    vec3 c5 = vec3(0.95, 0.95, 0.98);
    if (t < 0.25) return mix(c1, c2, t / 0.25);
    if (t < 0.5) return mix(c2, c3, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c3, c4, (t - 0.5) / 0.25);
    return mix(c4, c5, (t - 0.75) / 0.25);
}
vec3 layerSlope(float h, float sea) {
    vec2 tx = 1.0 / u_resolution;
    float hL = texture(u_elevTex, v_uv - vec2(tx.x, 0.0)).r;
    float hR = texture(u_elevTex, v_uv + vec2(tx.x, 0.0)).r;
    float hD = texture(u_elevTex, v_uv - vec2(0.0, tx.y)).r;
    float hU = texture(u_elevTex, v_uv + vec2(0.0, tx.y)).r;
    float s = sqrt(pow(hR - hL, 2.0) + pow(hU - hD, 2.0)) * 10.0;
    s = clamp(s, 0.0, 1.0);
    return mix(vec3(0.05, 0.05, 0.1), vec3(1.0, 0.9, 0.2), s);
}
vec3 layerMoisture(float moisture, float h, float sea) {
    if (h < sea) return vec3(0.05, 0.1, 0.25);
    // 湿度热力图：棕(干)→黄→青→蓝(湿)
    float m = clamp(moisture, 0.0, 1.0);
    vec3 c1 = vec3(0.5, 0.35, 0.15);
    vec3 c2 = vec3(0.85, 0.75, 0.25);
    vec3 c3 = vec3(0.25, 0.7, 0.55);
    vec3 c4 = vec3(0.1, 0.35, 0.7);
    if (m < 0.33) return mix(c1, c2, m / 0.33);
    if (m < 0.66) return mix(c2, c3, (m - 0.33) / 0.33);
    return mix(c3, c4, (m - 0.66) / 0.34);
}
vec3 layerTemperature(float temp, float h, float sea) {
    if (h < sea) return vec3(0.05, 0.1, 0.25);
    // 温度热力图：蓝(冷)→青→黄→橙→红(热)
    float t = clamp(temp, 0.0, 1.0);
    vec3 c1 = vec3(0.2, 0.3, 0.85);
    vec3 c2 = vec3(0.25, 0.65, 0.85);
    vec3 c3 = vec3(0.9, 0.85, 0.3);
    vec3 c4 = vec3(0.95, 0.5, 0.15);
    vec3 c5 = vec3(0.85, 0.15, 0.12);
    if (t < 0.25) return mix(c1, c2, t / 0.25);
    if (t < 0.5) return mix(c2, c3, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c3, c4, (t - 0.5) / 0.25);
    return mix(c4, c5, (t - 0.75) / 0.25);
}
vec3 layerPlates(float plateId, float boundary, float h, float sea) {
    float hue = fract(plateId * 0.618033988749895 + 0.05);
    vec3 base = hsv2rgb(vec3(hue, 0.65, 0.85));
    if (h < sea) base = hsv2rgb(vec3(hue, 0.45, 0.5));
    if (boundary > 0.1) {
        base = mix(base, vec3(1.0, 0.3, 0.15), boundary * 0.8);
    }
    return base;
}
vec3 layerBiome(float biomeNorm, float h, float sea) {
    if (h < sea) return vec3(0.05, 0.12, 0.3);
    // 15 种 Whittaker 生物群系配色
    int b = int(clamp(round(biomeNorm * 15.0), 0.0, 14.0));
    vec3 colors[15];
    colors[0] = vec3(0.1, 0.25, 0.5);   // 海洋
    colors[1] = vec3(0.95, 0.95, 1.0);  // 雪/冰
    colors[2] = vec3(0.55, 0.5, 0.45);  // 岩石
    colors[3] = vec3(0.85, 0.88, 0.92); // 冰盖
    colors[4] = vec3(0.5, 0.55, 0.45);  // 苔原
    colors[5] = vec3(0.6, 0.55, 0.4);   // 寒漠
    colors[6] = vec3(0.15, 0.35, 0.2);  // 针叶林
    colors[7] = vec3(0.1, 0.4, 0.15);   // 温带雨林
    colors[8] = vec3(0.2, 0.5, 0.18);   // 温带森林
    colors[9] = vec3(0.55, 0.55, 0.3);  // 灌丛
    colors[10] = vec3(0.65, 0.65, 0.35);// 草原
    colors[11] = vec3(0.05, 0.3, 0.08); // 热带雨林
    colors[12] = vec3(0.15, 0.45, 0.12);// 热带季雨林
    colors[13] = vec3(0.7, 0.65, 0.25); // 稀树草原
    colors[14] = vec3(0.85, 0.75, 0.45);// 热漠
    return colors[b];
}
vec3 layerRidge(float ridge, float ridgeMask, float h, float sea) {
    if (h < sea) return vec3(0.05, 0.1, 0.25);
    vec3 col = mix(vec3(0.15, 0.12, 0.1), vec3(0.95, 0.6, 0.2), ridge);
    if (ridgeMask > 0.5) col = mix(col, vec3(1.0, 0.85, 0.4), 0.6);
    return col;
}
vec3 azgaarColor(float h, float sea, float moisture, float temp, float river, float shade, float boundary) {
    vec3 col;
    if (h < sea - 0.15) {
        float t = clamp((h - (sea - 0.6)) / 0.45, 0.0, 1.0);
        col = mix(vec3(0.08, 0.14, 0.30), vec3(0.22, 0.38, 0.55), t);
    }
    else if (h < sea) {
        float t = clamp((h - (sea - 0.15)) / 0.15, 0.0, 1.0);
        col = mix(vec3(0.22, 0.38, 0.55), vec3(0.52, 0.62, 0.70), t);
    }
    else if (h < sea + 0.018 + u_detailCoastJagged * 0.008) {
        float jagged = vnoise(v_uv * 120.0) * u_detailCoastJagged * 0.015;
        col = vec3(0.38 + jagged, 0.36 + jagged * 0.5, 0.28 - jagged * 0.3);
    }
    else if (h < sea + 0.035) {
        float t = clamp((h - sea - 0.018) / 0.017, 0.0, 1.0);
        col = mix(vec3(0.38, 0.36, 0.28), vec3(0.82, 0.75, 0.55), t);
    }
    else if (h < sea + 0.12) {
        float t = clamp((h - sea - 0.035) / 0.085, 0.0, 1.0);
        vec3 lowWet = vec3(0.42, 0.56, 0.25);
        vec3 lowDry = vec3(0.62, 0.60, 0.30);
        vec3 low = mix(lowDry, lowWet, clamp(moisture * 1.4, 0.0, 1.0));
        col = mix(vec3(0.82, 0.75, 0.55), low, t);
    }
    else if (h < sea + 0.25) {
        float t = clamp((h - sea - 0.12) / 0.13, 0.0, 1.0);
        vec3 hillWet = vec3(0.35, 0.46, 0.18);
        vec3 hillDry = vec3(0.58, 0.48, 0.28);
        vec3 hill = mix(hillDry, hillWet, clamp(moisture, 0.0, 1.0));
        col = mix(hill, vec3(0.48, 0.38, 0.24), t);
    }
    else if (h < sea + 0.45) {
        float t = clamp((h - sea - 0.25) / 0.20, 0.0, 1.0);
        float ridgeNoise = vnoise(v_uv * 80.0) * u_detailRidgeDensity * 0.08;
        col = mix(vec3(0.48 + ridgeNoise, 0.38 + ridgeNoise * 0.6, 0.24 - ridgeNoise * 0.2), vec3(0.58, 0.54, 0.48), t);
    }
    else if (h < sea + 0.60) {
        float t = clamp((h - sea - 0.45) / 0.15, 0.0, 1.0);
        float ridgeNoise = vnoise(v_uv * 80.0) * u_detailRidgeDensity * 0.06;
        col = mix(vec3(0.58 + ridgeNoise, 0.54 + ridgeNoise * 0.5, 0.48 - ridgeNoise * 0.3), vec3(0.75, 0.73, 0.70), t);
    }
    else {
        float t = clamp((h - sea - 0.60) / 0.40, 0.0, 1.0);
        col = mix(vec3(0.75, 0.73, 0.70), vec3(0.93, 0.93, 0.95), t);
    }
    if (u_showRivers > 0.5 && river > 0.0 && h >= sea) {
        float rw = u_detailRiverWidth;
        float riverAlpha = river * (0.35 + rw * 0.30);
        vec3 riverCol = mix(vec3(0.30, 0.42, 0.58), vec3(0.40, 0.55, 0.72), river);
        col = mix(col, riverCol, clamp(riverAlpha, 0.0, 1.0));
    }
    float microVar = (vnoise(v_uv * 180.0) - 0.5) * 0.035;
    col = col * (1.0 + microVar);
    col = mix(col, col * vec3(1.04, 1.01, 0.96), 0.3);
    col *= shade;
    if (h >= sea && h < sea + 0.06) {
        vec2 tx2 = 1.0 / u_resolution;
        float hL = texture(u_elevTex, v_uv + vec2(-tx2.x, 0.0)).r;
        float hR = texture(u_elevTex, v_uv + vec2( tx2.x, 0.0)).r;
        float hU = texture(u_elevTex, v_uv + vec2(0.0,  tx2.y)).r;
        float hD = texture(u_elevTex, v_uv + vec2(0.0, -tx2.y)).r;
        bool nearSea = (hL < sea || hR < sea || hU < sea || hD < sea);
        if (nearSea) {
            col = mix(col, vec3(0.22, 0.20, 0.16), 0.65);
        }
    }
    if (u_showBoundaries > 0.5 && boundary > 0.1) {
        float dashPattern = step(0.5, fract(v_uv.x * 80.0 + v_uv.y * 60.0));
        col = mix(col, vec3(0.55, 0.18, 0.12), boundary * 0.7 * dashPattern);
    }
    float vignette = smoothstep(0.0, 0.4, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
    col *= mix(0.82, 1.0, vignette);
    return col;
}
float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float bb = dot(ba, ba);
    float h = bb > 1e-10 ? clamp(dot(pa, ba) / bb, 0.0, 1.0) : 0.0;
    return length(pa - ba * h);
}
bool isSelected(float plateIdNorm) {
    if (u_selectedCount == 0) return false;
    int pid = int(clamp(round(plateIdNorm * float(max(u_plateTotal, 1))), 0.0, float(max(u_plateTotal - 1, 0))));
    float mask = texture(u_selectionMaskTex, vec2((float(pid) + 0.5) / 256.0, 0.5)).r;
    return mask > 0.5;
}
void main() {
    vec2 uv = v_uv;
    float sea = u_seaLevel;
    vec3 col;
    float plateId = 0.0, boundary = 0.0, elev = 0.0, moisture = 0.0;
    if (u_style == 4) {
        float grid = u_resolution.x / 8.0;
        vec2 scaled = uv * grid;
        vec2 ip = floor(scaled);
        vec2 fp = fract(scaled);
        float tri = step(fp.x, fp.y);
        vec2 center = (tri < 0.5) ? (ip + vec2(0.666, 0.333)) / grid : (ip + vec2(0.333, 0.666)) / grid;
        elev = texture(u_elevTex, center).r; moisture = texture(u_moistureTex, center).r;
        vec4 pC = texture(u_plateTex, center); plateId = pC.r; boundary = pC.b;
        float tx = 1.0 / grid;
        float eL = texture(u_elevTex, center - vec2(tx, 0.0)).r;
        float eR = texture(u_elevTex, center + vec2(tx, 0.0)).r;
        float eD = texture(u_elevTex, center - vec2(0.0, tx)).r;
        float eU = texture(u_elevTex, center + vec2(0.0, tx)).r;
        vec3 n = normalize(vec3(eL - eR, eD - eU, 0.15));
        vec3 lightDir = normalize(vec3(cos(u_lightAngle), sin(u_lightAngle), 0.55));
        float shade = clamp(dot(n, lightDir), 0.25, 1.15);
        if (elev < sea) col = mix(vec3(0.25, 0.55, 0.90), vec3(0.08, 0.20, 0.50), sea > 0.001 ? (sea - elev) / sea : 0.0);
        else {
            float h = (elev - sea) / (1.0 - sea);
            if (h < 0.04) col = vec3(0.95, 0.88, 0.60);
            else if (h < 0.22) col = mix(vec3(0.45, 0.80, 0.30), vec3(0.30, 0.65, 0.20), (h - 0.04) / 0.18);
            else if (h < 0.50) col = mix(vec3(0.55, 0.50, 0.28), vec3(0.65, 0.58, 0.42), (h - 0.22) / 0.28);
            else if (h < 0.78) col = mix(vec3(0.75, 0.72, 0.68), vec3(0.88, 0.86, 0.84), (h - 0.50) / 0.28);
            else col = vec3(1.0, 1.0, 1.0);
        }
        if (elev >= sea && elev < sea + 0.45) col = mix(col, vec3(0.30, 0.75, 0.45), moisture * 0.25); col *= shade;
        float edgeDist = min(min(min(fp.x, 1.0 - fp.x), min(fp.y, 1.0 - fp.y)), abs(fp.x - fp.y) / 1.414);
        vec3 edgeCol = elev < sea ? vec3(0.05, 0.12, 0.28) : vec3(0.22, 0.18, 0.15);
        col = mix(edgeCol, col, smoothstep(0.0, 0.06, edgeDist));
    } else {
        vec4 plateData = texture(u_plateTex, uv);
        elev = texture(u_elevTex, uv).r; moisture = texture(u_moistureTex, uv).r;
        float temp = texture(u_tempTex, uv).r;
        float river = texture(u_riverTex, uv).r;
        moisture = clamp(moisture + u_detailRainfallOffset * 0.01, 0.0, 1.0);
        temp = clamp(temp + (u_detailTempGradient - 1.0) * 0.2, 0.0, 1.0);
        plateId = plateData.r; boundary = plateData.b;
        float shade = hillshade(uv, u_lightAngle);
        if (u_fbmOctaves > 0) {
            float detail = 0.0; vec2 p = uv * 12.0; float amp = 0.5; float freq = 1.0;
            for (int i = 0; i < 8; i++) {
                if (i >= u_fbmOctaves) break;
                detail += amp * vnoise(p * freq); freq *= u_fbmLacunarity; amp *= u_fbmPersistence;
            }
            elev += (detail - 0.5) * 0.08; elev = clamp(elev, 0.0, 1.0);
        }
        if (u_style == 0) col = terrainColor(elev, sea, moisture) * shade;
        else if (u_style == 1) col = platesColor(plateId, elev, sea, shade);
        else if (u_style == 2) col = parchmentColor(elev, sea, boundary, plateData.g);
        else if (u_style == 3) {
            if (elev < sea) col = mix(vec3(.08, .20, .45), vec3(.03, .08, .22), sea > 0.001 ? (sea - elev) / sea : 0.0);
            else {
                float m = clamp(moisture, 0.0, 1.0);
                col = m < 0.5 ? mix(vec3(.65, .58, .35), vec3(.25, .55, .18), m * 2.0) : mix(vec3(.25, .55, .18), vec3(.10, .38, .12), (m - 0.5) * 2.0);
                if (elev > sea + 0.3) col = mix(col, vec3(.92, .92, .95), (elev - sea - 0.3) / 0.2);
            } col *= shade;
        }
        else if (u_style == 5) col = terrainDetailColor(elev, sea, moisture, river, shade);
        else if (u_style == 6) col = biomeColor(temp, moisture, elev, sea, shade);
        else if (u_style == 7) col = contourColor(elev, sea, shade);
        else if (u_style == 8) col = reliefColor(elev, sea, shade);
        else if (u_style == 9) col = azgaarColor(elev, sea, moisture, temp, river, shade, boundary);
        else if (u_style == 10) col = layerElevation(elev, sea);
        else if (u_style == 11) col = layerSlope(elev, sea);
        else if (u_style == 12) col = layerMoisture(moisture, elev, sea);
        else if (u_style == 13) col = layerTemperature(temp, elev, sea);
        else if (u_style == 14) col = layerPlates(plateId, boundary, elev, sea);
        else if (u_style == 15) {
            float biome = texture(u_tempTex, uv).b;
            col = layerBiome(biome, elev, sea);
        }
        else if (u_style == 16) {
            vec4 elevData = texture(u_elevTex, uv);
            col = layerRidge(elevData.b, elevData.a, elev, sea);
        }
    }
    if (u_showBoundaries > 0.5 && u_style != 2 && u_style != 4 && u_style != 9) {
        float bw = u_boundaryWidth * 0.05; float bMask = smoothstep(bw, bw + 0.02, boundary);
        col = mix(col, u_boundaryColor, bMask);
    }
    if (u_showSelection > 0.5 && isSelected(plateId)) {
        float pulse = sin(u_time * 3.0) * 0.5 + 0.5;
        col = mix(col, vec3(1.0, 0.92, 0.3), 0.35 + pulse * 0.2);
    }
    if (u_showTerrain < 0.5) {
        col = vec3(0.08, 0.08, 0.12);
    }
    if (u_pointLightEnabled > 0.5) {
        vec2 delta = uv - u_pointLightPos; delta.x *= u_resolution.x / u_resolution.y;
        float dist = length(delta);
        float falloff = 1.0 / (1.0 + dist * 3.0 + dist * dist * 4.0);
        col += u_pointLightColor * falloff * u_pointLightIntensity * 0.25;
        if (u_glowEnabled > 0.5) {
            float halo = exp(-dist * 4.0) * 0.4; float scatter = exp(-dist * 8.0) * elev * 0.2;
            col += u_pointLightColor * (halo + scatter) * u_pointLightIntensity;
        }
    }
    if (u_laserActive > 0.5) {
        vec2 asp = vec2(u_resolution.x / u_resolution.y, 1.0);
        float dist = distToSegment(uv * asp, u_laserStart * asp, u_laserEnd * asp) * u_resolution.y;
        float pulse = 0.85 + 0.15 * sin(u_time * 5.0);
        float glow = smoothstep(u_laserWidth * 8.0, 0.0, dist) * 0.35 * pulse;
        float mid = smoothstep(u_laserWidth * 3.0, 0.0, dist) * 0.55 * pulse;
        float core = smoothstep(u_laserWidth * 0.5, 0.0, dist);
        vec3 glowCol = u_laserColor;
        vec3 midCol = u_laserColor * 0.7;
        vec3 coreCol = mix(u_laserColor, vec3(1.0), 0.7);
        col = mix(col, glowCol, glow);
        col = mix(col, midCol, mid);
        col = mix(col, coreCol, core);
        float dStart = length((uv - u_laserStart) * asp) * u_resolution.y;
        float dEnd = length((uv - u_laserEnd) * asp) * u_resolution.y;
        float endGlow1 = smoothstep(u_laserWidth * 12.0, 0.0, dStart) * 0.3 * pulse;
        float endGlow2 = smoothstep(u_laserWidth * 12.0, 0.0, dEnd) * 0.3 * pulse;
        col += u_laserColor * endGlow1;
        col += u_laserColor * endGlow2;
        if (u_laserSelection > 0.5) {
            vec2 a = u_laserStart * asp;
            vec2 b = u_laserEnd * asp;
            vec2 p = uv * asp;
            float area = abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
            if (dist <= u_laserWidth * 1.5) {
                col = mix(col, u_laserColor, 0.18 * pulse);
            }
            if (area < 0.002 && abs(b.x - a.x) > 1e-4) {
                col = mix(col, u_laserColor, 0.08);
            }
        }
    }
    if (u_cursorActive > 0.5) {
        vec2 asp = vec2(u_resolution.x / u_resolution.y, 1.0);
        float d = length((uv - u_cursorPos) * asp) * u_resolution.y;
        float ring = abs(d - u_cursorSize);
        float ringGlow = smoothstep(3.0, 0.0, ring) * 0.6;
        float innerGlow = smoothstep(u_cursorSize, u_cursorSize * 0.3, d) * 0.08;
        float outerGlow = smoothstep(u_cursorSize * 3.0, u_cursorSize, d) * 0.12;
        float pulse2 = 0.8 + 0.2 * sin(u_time * 3.5);
        vec3 cursorCol = vec3(1.0, 0.82, 0.35);
        col = mix(col, cursorCol, ringGlow * pulse2);
        col += cursorCol * innerGlow * pulse2;
        col += cursorCol * outerGlow * pulse2;
        float crossH = smoothstep(1.5, 0.0, abs(uv.y - u_cursorPos.y) * u_resolution.y) *
                       smoothstep(u_cursorSize * 3.0, u_cursorSize * 1.5, d) * 0.3;
        float crossV = smoothstep(1.5, 0.0, abs(uv.x - u_cursorPos.x) * u_resolution.y) *
                       smoothstep(u_cursorSize * 3.0, u_cursorSize * 1.5, d) * 0.3;
        col = mix(col, cursorCol, crossH + crossV);
    }
    if (u_hasTrail > 0.5) { vec4 trail = texture(u_trailTex, v_uv); col = mix(col, trail.rgb, trail.a); }
    fragColor = vec4(pow(col, vec3(0.95)), 1.0);
}
