export interface RenderParams {
  u_style?: number;
  u_seaLevel?: number;
  u_lightAngle?: number;
  u_showBoundaries?: boolean;
  u_boundaryWidth?: number;
  u_boundaryColor?: number[];
  u_showRivers?: boolean;
  u_showContours?: boolean;
  u_contourInterval?: number;
  u_showTerrain?: boolean;
  u_showSelection?: boolean;
  u_showClimate?: boolean;
  u_pointLightEnabled?: boolean;
  u_pointLightPos?: number[];
  u_pointLightIntensity?: number;
  u_pointLightColor?: number[];
  u_glowEnabled?: boolean;
  u_laserActive?: boolean;
  u_laserStart?: number[];
  u_laserEnd?: number[];
  u_laserWidth?: number;
  u_laserSelection?: boolean;
  u_laserColor?: number[];
  u_hasTrail?: boolean;
  u_cursorActive?: boolean;
  u_cursorPos?: number[];
  u_cursorSize?: number;
  u_snowLine?: number;
  u_erosionStrength?: number;
  u_fbmOctaves?: number;
  u_fbmLacunarity?: number;
  u_fbmPersistence?: number;
  u_zoom?: number;
  u_pan?: number[];
}

export type UniformValue = number | boolean | number[];
