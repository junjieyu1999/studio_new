"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Artwork } from "@/types/artwork";
import { setStops } from "@/lib/guided-nav";
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

// Warm "hygge" palettes. Daylight pours through the glass roof; at night the
// room falls away and each piece is picked out by a warm lamp.
const PALETTES = {
  // Blue skies through the glass roof.
  day: {
    bg: "#a9c9e6",
    fogNear: 20,
    fogFar: 60,
    ambient: 0.7,
    hemiSky: "#d3e6f9",
    hemiGround: "#9c7b52",
    hemi: 0.9,
    sun: 1.0,
    sunColor: "#fff6e6",
    wall: "#e5dccb",
    beam: "#cfc5b1",
    glass: "#d2e8ff",
    glassOpacity: 0.14,
    glassEmissive: 0.34,
    spot: 5,
    spotColor: "#fff0d6",
    panel: 6,
    bloom: 0.2,
    vignette: 0.45,
  },
  // Low sun, reddish-orange skies.
  golden: {
    bg: "#dd9a55",
    fogNear: 16,
    fogFar: 50,
    ambient: 0.48,
    hemiSky: "#ffbe78",
    hemiGround: "#7a5230",
    hemi: 0.75,
    sun: 1.15,
    sunColor: "#ff9d4d",
    wall: "#e2cba6",
    beam: "#b89168",
    glass: "#ffbe80",
    glassOpacity: 0.2,
    glassEmissive: 0.6,
    spot: 9,
    spotColor: "#ffd39a",
    panel: 8,
    bloom: 0.4,
    vignette: 0.58,
  },
  night: {
    bg: "#0d0b09",
    fogNear: 10,
    fogFar: 34,
    ambient: 0.18,
    hemiSky: "#2c2418",
    hemiGround: "#100c08",
    hemi: 0.3,
    sun: 0,
    sunColor: "#243049",
    wall: "#3c3329",
    beam: "#221c15",
    glass: "#0a0e1a",
    glassOpacity: 0.5,
    glassEmissive: 0.05,
    spot: 18,
    spotColor: "#ffcf8f",
    panel: 11,
    bloom: 0.5,
    vignette: 0.75,
  },
} as const;

type Palette = (typeof PALETTES)[TimeMode];

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

// Warm lamp aimed at a single piece.
function PaintingLight({
  position,
  palette,
}: {
  position: [number, number, number];
  palette: Palette;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (light.current && target.current) {
      light.current.target = target.current;
      light.current.target.updateMatrixWorld();
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
        intensity={palette.spot}
        distance={10}
        decay={2}
        color={palette.spotColor}
      />
      <object3D ref={target} position={[x, y, z]} />
    </>
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
          <meshStandardMaterial color={palette.beam} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}

      {/* cross mullions */}
      {Array.from({ length: crossCount }).map((_, i) => (
        <mesh
          key={`cb-${i}`}
          position={[0, WALL_HEIGHT - 0.07, (i + 0.5) * (length / crossCount)]}
        >
          <boxGeometry args={[CORRIDOR_WIDTH, 0.1, 0.07]} />
          <meshStandardMaterial color={palette.beam} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
    </group>
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

  const bounds = {
    minX: -CORRIDOR_WIDTH / 2 + 0.7,
    maxX: CORRIDOR_WIDTH / 2 - 0.7,
    minZ: 0.6,
    maxZ: corridorLength - 0.6,
  };

  const halfW = CORRIDOR_WIDTH / 2;

  return (
    <>
      <fog attach="fog" args={[palette.bg, palette.fogNear, palette.fogFar]} />
      <color attach="background" args={[palette.bg]} />

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

      {/* Side walls */}
      {[-1, 1].map((s) => (
        <mesh
          key={`wall${s}`}
          rotation={[0, s * (Math.PI / 2), 0]}
          position={[s * halfW, WALL_HEIGHT / 2, corridorLength / 2]}
        >
          <planeGeometry args={[corridorLength, WALL_HEIGHT]} />
          <meshStandardMaterial color={palette.wall} roughness={0.95} />
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

      {/* Paintings, their lamps, and a bench facing each */}
      {placed.map(({ artwork, position, rotationY }) => (
        <group key={artwork.id}>
          <Painting artwork={artwork} position={position} rotationY={rotationY} />
          <PaintingLight position={position} palette={palette} />
          <Bench x={position[0]} z={position[2]} />
        </group>
      ))}

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
