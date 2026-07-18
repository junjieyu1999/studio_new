"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Artwork } from "@/types/artwork";
import { setStops } from "@/lib/guided-nav";
import { BEAM_COLOR, WALL_COLOR } from "@/lib/gallery-theme";
import type { TimeMode } from "@/lib/time-of-day";
import { AboutWall } from "./AboutWall";
import { BackWall } from "./BackWall";
import { Painting } from "./Painting";
import { WalkControls } from "./WalkControls";

const CORRIDOR_WIDTH = 8;
const WALL_HEIGHT = 5;
const SPACING = 5;
const START_Z = 4.5;
const MARGIN = 4;

// Wood plank texture tile size, in world units.
const WOOD_TILE_X = 1.2;
const WOOD_TILE_Z = 3;

// The room itself stays constant (see gallery-theme); only the sky beyond the
// glass roof — and the light falling through it — changes with the hour. Light
// colours stay near-neutral so the walls never take on a blue/orange cast.

const PALETTES = {
  // Blue skies through the glass roof.
  day: {
    bg: "#a9c9e6",
    fogNear: 26,
    fogFar: 70,
    ambient: 0.72,
    hemiSky: "#f7f3ea",
    hemiGround: "#a0855f",
    hemi: 0.75,
    sun: 1.0,
    sunColor: "#fff6e6",
    glass: "#bcdcfb",
    glassOpacity: 0.2,
    glassEmissive: 0.5,
    cloudOpacity: 0.9,
    spot: 5,
    spotColor: "#fff0d6",
    panel: 6,
    bloom: 0.2,
    vignette: 0.45,
  },
  // Low sun, reddish-orange skies.
  golden: {
    bg: "#d2743c",
    fogNear: 22,
    fogFar: 60,
    ambient: 0.6,
    hemiSky: "#fff0dd",
    hemiGround: "#8a6742",
    hemi: 0.7,
    sun: 1.05,
    sunColor: "#ffb066",
    glass: "#ffab5e",
    glassOpacity: 0.3,
    glassEmissive: 0.75,
    cloudOpacity: 1,
    spot: 8,
    spotColor: "#ffd39a",
    panel: 8,
    bloom: 0.4,
    vignette: 0.58,
  },
  night: {
    bg: "#0b0e18",
    fogNear: 10,
    fogFar: 34,
    ambient: 0.18,
    hemiSky: "#2c2418",
    hemiGround: "#100c08",
    hemi: 0.3,
    sun: 0,
    sunColor: "#243049",
    glass: "#070a14",
    glassOpacity: 0.62,
    glassEmissive: 0.04,
    cloudOpacity: 0.8,
    spot: 18,
    spotColor: "#ffcf8f",
    panel: 11,
    bloom: 0.5,
    vignette: 0.75,
  },
} as const;

type Palette = (typeof PALETTES)[TimeMode];

/**
 * Sky painted onto a transparent canvas, per time of day. Everything is drawn
 * nine times (offset by ±one tile) so the texture wraps seamlessly and can be
 * scrolled forever without a visible seam.
 *   day    — soft white cumulus
 *   golden — dark, backlit cloud bodies with fiery orange rims
 *   night  — scattered white star specks
 */
// Vertical gradient sky shown through the glass roof (screen top = up/zenith,
// screen bottom = toward the horizon).
function makeGradientBackground(mode: TimeMode): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const stops: Record<TimeMode, [number, string][]> = {
    day: [
      [0, "#7fb0e4"],
      [1, "#cfe6f6"],
    ],
    // orange at the horizon fading up into deep blue
    golden: [
      [0, "#16233f"],
      [0.42, "#7c4a55"],
      [0.72, "#df8347"],
      [1, "#f4a44a"],
    ],
    night: [
      [0, "#05060d"],
      [1, "#111d33"],
    ],
  };

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [pos, col] of stops[mode]) g.addColorStop(pos, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture(mode: TimeMode): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Draw `fn` at the point and its 8 wrap-around copies.
  const tiled = (x: number, y: number, fn: (x: number, y: number) => void) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) fn(x + dx * S, y + dy * S);
  };

  if (mode === "night") {
    for (let i = 0; i < 110; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 0.3 + Math.random() * 0.7; // smaller specks
      const a = 0.35 + Math.random() * 0.6;
      tiled(x, y, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 1.8);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.5, `rgba(255,255,255,${a * 0.4})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  const golden = mode === "golden";

  const puff = (x: number, y: number, r: number, a: number) => {
    // Soft, feathered body — a single-colour fade, so overlapping puffs blend
    // instead of forming concentric rings.
    const body = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (golden) {
      body.addColorStop(0, `rgba(38,30,48,${a})`);
      body.addColorStop(0.7, `rgba(38,30,48,${a * 0.55})`);
      body.addColorStop(1, "rgba(38,30,48,0)");
    } else {
      body.addColorStop(0, `rgba(255,255,255,${a})`);
      body.addColorStop(0.45, `rgba(255,255,255,${a * 0.55})`);
      body.addColorStop(1, "rgba(255,255,255,0)");
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (golden) {
      // Warm sun-catch on the LEFT edge only, added as light so it glows
      // without a hard ring.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gx = x - r * 0.5;
      const glow = ctx.createRadialGradient(gx, y, 0, gx, y, r * 0.85);
      glow.addColorStop(0, `rgba(255,150,72,${a * 0.5})`);
      glow.addColorStop(1, "rgba(255,150,72,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  for (let c = 0; c < 9; c++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const puffs = 5 + Math.floor(Math.random() * 5);
    for (let p = 0; p < puffs; p++) {
      const ox = cx + (Math.random() - 0.5) * 130;
      const oy = cy + (Math.random() - 0.5) * 60;
      const r = 30 + Math.random() * 55;
      const a = golden ? 0.55 + Math.random() * 0.35 : 0.3 + Math.random() * 0.3;
      tiled(ox, oy, (px, py) => puff(px, py, r, a));
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// Procedural oak planks running the length of the corridor.
function makeWoodTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const planks = 5;
  const pw = w / planks;
  const tones = ["#8a6039", "#7d5531", "#956844", "#835a35", "#8f6340"];

  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(x, 0, pw, h);

    // grain streaks running along the plank
    ctx.strokeStyle = "rgba(58,34,16,0.18)";
    ctx.lineWidth = 1;
    for (let g = 0; g < 26; g++) {
      const gx = x + Math.random() * pw;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + (Math.random() * 6 - 3),
        h * 0.33,
        gx + (Math.random() * 6 - 3),
        h * 0.66,
        gx + (Math.random() * 4 - 2),
        h
      );
      ctx.stroke();
    }

    // seam between planks
    ctx.fillStyle = "rgba(32,18,7,0.55)";
    ctx.fillRect(x, 0, 2, h);

    // staggered end joint
    ctx.fillRect(x, ((i * 97) % h), pw, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

interface Placed {
  artwork: Artwork;
  position: [number, number, number];
  rotationY: number;
}

function layout(artworks: Artwork[]) {
  const rows = Math.max(1, Math.ceil(artworks.length / 2));
  const corridorLength = rows * SPACING + MARGIN;

  const placed: Placed[] = artworks.map((artwork, i) => {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const z = START_Z + row * SPACING;
    const x = side * (CORRIDOR_WIDTH / 2 - 0.04);
    const rotationY = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    // Hung high on the wall, gallery-style.
    return { artwork, position: [x, 2.15, z], rotationY };
  });

  const stops = [
    1.2,
    ...Array.from({ length: rows }, (_, r) => START_Z + r * SPACING),
    corridorLength - 1.4,
  ];

  return { placed, corridorLength, stops };
}

function randomSeed() {
  return Math.random() * 10;
}

// Smooth pseudo-random flicker: two out-of-phase sines so it never repeats
// obviously. Swing is ±0.045 around ~0.91 (a gentle, halved flicker).
function flicker(t: number, seed: number) {
  const a = Math.sin(t * 9.3 + seed) * 0.5 + 0.5;
  const b = Math.sin(t * 5.1 + seed * 3.7) * 0.5 + 0.5;
  return 0.865 + 0.09 * (a * 0.6 + b * 0.4);
}

// Warm lamp aimed at a single piece, with a gentle candle flicker.
function PaintingLight({
  position,
  palette,
}: {
  position: [number, number, number];
  palette: Palette;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  const seed = useMemo(() => randomSeed(), []);
  useEffect(() => {
    if (light.current && target.current) {
      light.current.target = target.current;
      light.current.target.updateMatrixWorld();
    }
  });

  useFrame((state) => {
    if (light.current) {
      light.current.intensity =
        palette.spot * 0.5 * flicker(state.clock.elapsedTime, seed);
    }
  });

  const [x, y, z] = position;
  const toward = x < 0 ? 1.1 : -1.1;
  return (
    <>
      <spotLight
        ref={light}
        position={[x + toward, WALL_HEIGHT - 0.9, z]}
        angle={0.7}
        penumbra={0.95}
        intensity={palette.spot * 0.5}
        distance={10}
        decay={2}
        color={palette.spotColor}
      />
      <object3D ref={target} position={[x, y, z]} />
    </>
  );
}

// Warm wall sconce: a small emissive fixture + a flickering point light. The
// glow is strongest at night, where the cozy factor matters most.
function Sconce({
  x,
  z,
  facing,
  palette,
  mode,
}: {
  x: number;
  z: number;
  facing: number; // +1 or -1: which way the light spills into the room
  palette: Palette;
  mode: TimeMode;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => randomSeed(), []);
  const base = mode === "night" ? 4.5 : mode === "golden" ? 2.2 : 0.9;

  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = base * flicker(state.clock.elapsedTime, seed);
    }
  });

  return (
    <group position={[x, 2.5, z]}>
      {/* little brass shade */}
      <mesh>
        <cylinderGeometry args={[0.05, 0.11, 0.26, 12, 1, true]} />
        <meshStandardMaterial
          color="#caa25a"
          emissive={palette.spotColor}
          emissiveIntensity={mode === "night" ? 1.6 : 0.5}
          metalness={0.6}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[facing * 0.35, 0, 0]}
        intensity={base}
        distance={4.5}
        decay={2}
        color={palette.spotColor}
      />
    </group>
  );
}

// Viewing bench placed in front of a piece, parallel to its wall.
function Bench({ x, z }: { x: number; z: number }) {
  const bx = x + (x < 0 ? 1.7 : -1.7);
  return (
    <group position={[bx, 0, z]}>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.6, 0.1, 1.7]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.2, -0.65]}>
        <boxGeometry args={[0.5, 0.38, 0.1]} />
        <meshStandardMaterial color="#4f3620" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 0.65]}>
        <boxGeometry args={[0.5, 0.38, 0.1]} />
        <meshStandardMaterial color="#4f3620" roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Drifting cloud layer sitting well above the glass roof, so it reads as real
 * sky seen through the panes. Unlit (meshBasic) — it is sky, not a surface in
 * the room — and tinted per palette so it turns pink at golden hour and dark
 * at night.
 */
function CloudLayer({
  length,
  palette,
  mode,
}: {
  length: number;
  palette: Palette;
  mode: TimeMode;
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  // Colours are baked into the texture, so it is rebuilt when the mode changes.
  const tex = useMemo(() => makeSkyTexture(mode), [mode]);
  useEffect(() => {
    const t = tex;
    return () => t?.dispose();
  }, [tex]);

  // Stars barely move; clouds drift at a comfortable clip.
  const speed = mode === "night" ? 0.0016 : 0.011;

  useFrame((_, delta) => {
    const map = matRef.current?.map;
    if (!map) return;
    map.offset.x += delta * speed;
    map.offset.y += delta * speed * 0.35;
  });

  if (!tex) return null;

  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, WALL_HEIGHT + 7, length / 2]}
      renderOrder={-1}
    >
      <planeGeometry args={[CORRIDOR_WIDTH * 6, length * 2]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        transparent
        opacity={palette.cloudOpacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Glass roof with metal mullions — the room's daylight source.
function GlassRoof({ length, palette }: { length: number; palette: Palette }) {
  const crossCount = Math.max(1, Math.floor(length / 1.6));
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, length / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, length]} />
        <meshStandardMaterial
          color={palette.glass}
          emissive={palette.glass}
          emissiveIntensity={palette.glassEmissive}
          transparent
          opacity={palette.glassOpacity}
          roughness={0.12}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* beams running the length */}
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={`lb-${x}`} position={[x, WALL_HEIGHT - 0.07, length / 2]}>
          <boxGeometry args={[0.07, 0.12, length]} />
          <meshStandardMaterial color={BEAM_COLOR} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}

      {/* cross mullions */}
      {Array.from({ length: crossCount }).map((_, i) => (
        <mesh
          key={`cb-${i}`}
          position={[0, WALL_HEIGHT - 0.07, (i + 0.5) * (length / crossCount)]}
        >
          <boxGeometry args={[CORRIDOR_WIDTH, 0.1, 0.07]} />
          <meshStandardMaterial color={BEAM_COLOR} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function makeMoteGeometry(length: number): THREE.BufferGeometry {
  const count = 120;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * (CORRIDOR_WIDTH - 1);
    arr[i * 3 + 1] = 0.4 + Math.random() * (WALL_HEIGHT - 1);
    arr[i * 3 + 2] = Math.random() * length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return g;
}

// Slow-floating dust caught in the light.
function DustMotes({ length }: { length: number }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => makeMoteGeometry(length), [length]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.18) * 0.12;
    ref.current.position.x = Math.sin(t * 0.11) * 0.08;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.035}
        color="#ffe9c8"
        transparent
        opacity={0.25}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function GalleryScene({
  artworks,
  mode,
}: {
  artworks: Artwork[];
  mode: TimeMode;
}) {
  const palette = PALETTES[mode];
  const isNight = mode === "night";
  // Golden hour sits low on the horizon; midday is overhead.
  const sunY = mode === "golden" ? 3.5 : 14;

  const { placed, corridorLength, stops } = useMemo(
    () => layout(artworks),
    [artworks]
  );

  useEffect(() => {
    setStops(stops);
  }, [stops]);

  const floorTexture = useMemo(() => {
    const tex = makeWoodTexture();
    if (tex) {
      tex.repeat.set(CORRIDOR_WIDTH / WOOD_TILE_X, corridorLength / WOOD_TILE_Z);
      tex.anisotropy = 8;
    }
    return tex;
  }, [corridorLength]);
  useEffect(() => {
    const tex = floorTexture;
    return () => tex?.dispose();
  }, [floorTexture]);

  // Gradient sky, rebuilt per mode.
  const bgTexture = useMemo(() => makeGradientBackground(mode), [mode]);
  useEffect(() => {
    const tex = bgTexture;
    return () => tex?.dispose();
  }, [bgTexture]);

  const bounds = {
    minX: -CORRIDOR_WIDTH / 2 + 0.7,
    maxX: CORRIDOR_WIDTH / 2 - 0.7,
    minZ: 0.6,
    maxZ: corridorLength - 0.6,
  };

  const halfW = CORRIDOR_WIDTH / 2;
  const rows = Math.max(1, Math.ceil(artworks.length / 2));
  const sconceZs = Array.from(
    { length: rows + 1 },
    (_, k) => START_Z - SPACING / 2 + k * SPACING
  ).filter((z) => z > 1 && z < corridorLength - 1);
  return (
    <>
      <fog attach="fog" args={[palette.bg, palette.fogNear, palette.fogFar]} />
      {bgTexture ? (
        <primitive attach="background" object={bgTexture} />
      ) : (
        <color attach="background" args={[palette.bg]} />
      )}

      <ambientLight intensity={palette.ambient} />
      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemi]}
      />
      {!isNight && (
        <directionalLight
          position={[6, sunY, corridorLength * 0.35]}
          intensity={palette.sun}
          color={palette.sunColor}
        />
      )}

      {/* Warm wash on the reviews + about walls so they stay legible at night */}
      <pointLight
        position={[0, 3.2, 1.6]}
        intensity={palette.panel}
        distance={7}
        decay={2}
        color={palette.spotColor}
      />
      <pointLight
        position={[0, 3.2, corridorLength - 1.6]}
        intensity={palette.panel}
        distance={7}
        decay={2}
        color={palette.spotColor}
      />

      <CloudLayer length={corridorLength} palette={palette} mode={mode} />
      <GlassRoof length={corridorLength} palette={palette} />

      {/* Wooden floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, corridorLength / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, corridorLength]} />
        <MeshReflectorMaterial
          map={floorTexture ?? undefined}
          color={floorTexture ? "#ffffff" : "#7d5531"}
          resolution={1024}
          blur={[500, 260]}
          mixBlur={1.4}
          mixStrength={isNight ? 0.45 : 0.25}
          mixContrast={1}
          roughness={0.75}
          metalness={0.05}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
        />
      </mesh>

      {/* Side walls. Rotation is -s so each plane's normal faces INTO the room:
          the left wall (s=-1, x=-4) needs +90deg, the right wall (s=+1) -90deg.
          With the sign flipped they get back-face culled and you see the sky
          straight through them. */}
      {[-1, 1].map((s) => (
        <mesh
          key={`wall${s}`}
          rotation={[0, -s * (Math.PI / 2), 0]}
          position={[s * halfW, WALL_HEIGHT / 2, corridorLength / 2]}
        >
          <planeGeometry args={[corridorLength, WALL_HEIGHT]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
        </mesh>
      ))}

      {/* Skirting + picture rail */}
      {[-1, 1].map((s) => (
        <group key={`trim${s}`}>
          <mesh position={[s * (halfW - 0.06), 0.13, corridorLength / 2]}>
            <boxGeometry args={[0.12, 0.26, corridorLength]} />
            <meshStandardMaterial color="#5b4229" roughness={0.55} />
          </mesh>
          <mesh position={[s * (halfW - 0.07), WALL_HEIGHT - 0.5, corridorLength / 2]}>
            <boxGeometry args={[0.1, 0.1, corridorLength]} />
            <meshStandardMaterial color="#6b5230" roughness={0.5} metalness={0.25} />
          </mesh>
        </group>
      ))}

      <BackWall width={CORRIDOR_WIDTH} z={0} />
      <AboutWall width={CORRIDOR_WIDTH} z={corridorLength} />

      {/* Warm wall sconces between the pieces */}
      {sconceZs.map((sz) =>
        [-1, 1].map((s) => (
          <Sconce
            key={`sconce${s}-${sz}`}
            x={s * (halfW - 0.12)}
            z={sz}
            facing={-s}
            palette={palette}
            mode={mode}
          />
        ))
      )}

      {/* Paintings, their lamps, and a bench facing each */}
      {placed.map(({ artwork, position, rotationY }) => (
        <group key={artwork.id}>
          <Painting artwork={artwork} position={position} rotationY={rotationY} />
          <PaintingLight position={position} palette={palette} />
          <Bench x={position[0]} z={position[2]} />
        </group>
      ))}

      {/* Dust drifting in the light */}
      <DustMotes length={corridorLength} />

      <WalkControls bounds={bounds} initialYaw={Math.PI} />

      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={palette.bloom}
          luminanceThreshold={1.0}
          luminanceSmoothing={0.3}
        />
        <Vignette offset={0.3} darkness={palette.vignette} eskil={false} />
      </EffectComposer>
    </>
  );
}
