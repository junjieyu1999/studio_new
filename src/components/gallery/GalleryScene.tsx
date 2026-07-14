"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Artwork } from "@/types/artwork";
import { setStops } from "@/lib/guided-nav";
import { AboutWall } from "./AboutWall";
import { BackWall } from "./BackWall";
import { Painting } from "./Painting";
import { WalkControls } from "./WalkControls";

const CORRIDOR_WIDTH = 8;
const WALL_HEIGHT = 5;
const SPACING = 5;
const START_Z = 4.5;
const MARGIN = 4;
const TILE_SIZE = 1.6; // world units per floor tile

const WALL_COLOR = "#7a7264"; // medium warm greige gallery wall
const TRIM_DARK = "#14110c";
const GOLD = "#6f5426";

// Procedural stone-tile texture: a light tile with a darker grout border.
function makeTileTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#cdc7b8"; // grout / gap color
  ctx.fillRect(0, 0, s, s);

  const inset = s * 0.045;
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, "#e4dfd3");
  grad.addColorStop(0.5, "#d8d2c4");
  grad.addColorStop(1, "#ded8cb");
  ctx.fillStyle = grad;
  ctx.fillRect(inset, inset, s - inset * 2, s - inset * 2);

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
    return { artwork, position: [x, 1.7, z], rotationY };
  });

  // Viewing stations for the Prev/Next buttons: the entrance, then one facing
  // each row of paintings, then the far end. Scales with any artwork count.
  const stops = [
    1.2,
    ...Array.from({ length: rows }, (_, r) => START_Z + r * SPACING),
    corridorLength - 1.4,
  ];

  return { placed, corridorLength, stops, rows };
}

// Track spotlight aimed at a single painting on the wall.
function PaintingLight({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (light.current && target.current) {
      light.current.target = target.current;
      light.current.target.updateMatrixWorld();
    }
  });
  const [x, y, z] = position;
  const toward = x < 0 ? 1.1 : -1.1; // pull the light in toward the corridor
  return (
    <>
      <spotLight
        ref={light}
        position={[x + toward, WALL_HEIGHT - 0.5, z]}
        angle={0.6}
        penumbra={0.75}
        intensity={20}
        distance={9}
        decay={2}
        color="#fff2d6"
      />
      <object3D ref={target} position={[x, y, z]} />
    </>
  );
}

// Marble viewing bench down the centre of the gallery.
function Bench({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.95, 0.14, 2.0]} />
        <meshStandardMaterial color="#d6d0c2" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.7, 0.32, 1.7]} />
        <meshStandardMaterial color="#b9b2a2" roughness={0.55} />
      </mesh>
    </group>
  );
}

export function GalleryScene({ artworks }: { artworks: Artwork[] }) {
  const { placed, corridorLength, stops, rows } = useMemo(
    () => layout(artworks),
    [artworks]
  );

  useEffect(() => {
    setStops(stops);
  }, [stops]);

  // Tiled floor texture, tiled to the corridor size. Configured at creation
  // time (mutating a hook return value elsewhere trips react-hooks/immutability).
  const floorTexture = useMemo(() => {
    const tex = makeTileTexture();
    if (tex) {
      tex.repeat.set(CORRIDOR_WIDTH / TILE_SIZE, corridorLength / TILE_SIZE);
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
  const pilasterZs = Array.from(
    { length: rows + 1 },
    (_, k) => START_Z - SPACING / 2 + k * SPACING
  );
  const benchZs = Array.from(
    { length: Math.max(0, rows - 1) },
    (_, k) => START_Z + SPACING / 2 + k * SPACING
  );

  return (
    <>
      <fog attach="fog" args={["#0b0a09", 14, 40]} />
      <color attach="background" args={["#0b0a09"]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 8, 2]} intensity={0.4} />

      {/* Ceiling light strips */}
      {Array.from({ length: Math.ceil(corridorLength / 4) }).map((_, i) => (
        <mesh key={i} position={[0, WALL_HEIGHT - 0.05, 3 + i * 4]}>
          <boxGeometry args={[1.2, 0.05, 0.5]} />
          <meshStandardMaterial
            color="#fff8e6"
            emissive="#fff2cf"
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Fewer ceiling point lights — the painting spotlights do the work */}
      {Array.from({ length: Math.ceil(corridorLength / 8) }).map((_, i) => (
        <pointLight
          key={`pl-${i}`}
          position={[0, WALL_HEIGHT - 0.4, 4 + i * 8]}
          intensity={11}
          distance={13}
          decay={2}
        />
      ))}

      {/* Reflective tiled floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, corridorLength / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, corridorLength]} />
        <MeshReflectorMaterial
          map={floorTexture ?? undefined}
          color={floorTexture ? "#ffffff" : "#cfc9bb"}
          resolution={1024}
          blur={[420, 220]}
          mixBlur={1.1}
          mixStrength={0.8}
          mixContrast={1}
          roughness={0.9}
          metalness={0.1}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
        />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, corridorLength / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, corridorLength]} />
        <meshStandardMaterial color="#171410" roughness={0.9} />
      </mesh>

      {/* Side walls (dark) */}
      {[-1, 1].map((s) => (
        <mesh
          key={`wall${s}`}
          rotation={[0, s * (Math.PI / 2), 0]}
          position={[s * halfW, WALL_HEIGHT / 2, corridorLength / 2]}
        >
          <planeGeometry args={[corridorLength, WALL_HEIGHT]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
        </mesh>
      ))}

      {/* Baseboards + gold cornice along both side walls */}
      {[-1, 1].map((s) => (
        <group key={`trim${s}`}>
          <mesh position={[s * (halfW - 0.06), 0.13, corridorLength / 2]}>
            <boxGeometry args={[0.12, 0.26, corridorLength]} />
            <meshStandardMaterial color={TRIM_DARK} roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[s * (halfW - 0.08), WALL_HEIGHT - 0.18, corridorLength / 2]}>
            <boxGeometry args={[0.16, 0.22, corridorLength]} />
            <meshStandardMaterial color={GOLD} roughness={0.5} metalness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Pilasters between paintings */}
      {pilasterZs.map((pz) =>
        [-1, 1].map((s) => (
          <mesh
            key={`pil${s}-${pz}`}
            position={[s * (halfW - 0.09), WALL_HEIGHT / 2, pz]}
          >
            <boxGeometry args={[0.22, WALL_HEIGHT, 0.34]} />
            <meshStandardMaterial color="#635c4f" roughness={0.85} />
          </mesh>
        ))
      )}

      {/* Central benches */}
      {benchZs.map((bz) => (
        <Bench key={`bench-${bz}`} z={bz} />
      ))}

      {/* Back wall (behind spawn) — collector reviews */}
      <BackWall width={CORRIDOR_WIDTH} z={0} />

      {/* Far end wall — clickable About the artist */}
      <AboutWall width={CORRIDOR_WIDTH} z={corridorLength} />

      {/* Paintings + their track spotlights */}
      {placed.map(({ artwork, position, rotationY }) => (
        <group key={artwork.id}>
          <Painting artwork={artwork} position={position} rotationY={rotationY} />
          <PaintingLight position={position} />
        </group>
      ))}

      <WalkControls bounds={bounds} initialYaw={Math.PI} />

      {/* Cinematic post-processing */}
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={0.65}
          luminanceThreshold={1.0}
          luminanceSmoothing={0.2}
        />
        <Vignette offset={0.28} darkness={0.72} eskil={false} />
      </EffectComposer>
    </>
  );
}
