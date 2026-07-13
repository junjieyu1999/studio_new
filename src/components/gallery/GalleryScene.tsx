"use client";

import { useEffect, useMemo } from "react";
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

  return { placed, corridorLength, stops };
}

export function GalleryScene({ artworks }: { artworks: Artwork[] }) {
  const { placed, corridorLength, stops } = useMemo(
    () => layout(artworks),
    [artworks]
  );

  useEffect(() => {
    setStops(stops);
  }, [stops]);

  const bounds = {
    minX: -CORRIDOR_WIDTH / 2 + 0.7,
    maxX: CORRIDOR_WIDTH / 2 - 0.7,
    minZ: 0.6,
    maxZ: corridorLength - 0.6,
  };

  return (
    <>
      <fog attach="fog" args={["#0e0d0c", 12, 38]} />
      <color attach="background" args={["#0e0d0c"]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 2]} intensity={0.6} />

      {/* Ceiling light strips */}
      {Array.from({ length: Math.ceil(corridorLength / 4) }).map((_, i) => (
        <mesh key={i} position={[0, WALL_HEIGHT - 0.05, 3 + i * 4]}>
          <boxGeometry args={[1.2, 0.05, 0.5]} />
          <meshStandardMaterial
            color="#fff8e6"
            emissive="#fff2cf"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {Array.from({ length: Math.ceil(corridorLength / 4) }).map((_, i) => (
        <pointLight
          key={`pl-${i}`}
          position={[0, WALL_HEIGHT - 0.4, 3 + i * 4]}
          intensity={12}
          distance={8}
          decay={2}
        />
      ))}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, corridorLength / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, corridorLength]} />
        <meshStandardMaterial color="#d9d4c9" roughness={0.75} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, corridorLength / 2]}>
        <planeGeometry args={[CORRIDOR_WIDTH, corridorLength]} />
        <meshStandardMaterial color="#efece5" roughness={0.9} />
      </mesh>

      {/* Walls */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-CORRIDOR_WIDTH / 2, WALL_HEIGHT / 2, corridorLength / 2]}
      >
        <planeGeometry args={[corridorLength, WALL_HEIGHT]} />
        <meshStandardMaterial color="#efece5" roughness={0.95} />
      </mesh>
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[CORRIDOR_WIDTH / 2, WALL_HEIGHT / 2, corridorLength / 2]}
      >
        <planeGeometry args={[corridorLength, WALL_HEIGHT]} />
        <meshStandardMaterial color="#efece5" roughness={0.95} />
      </mesh>
      {/* Back wall (behind spawn) — collector reviews */}
      <BackWall width={CORRIDOR_WIDTH} z={0} />

      {/* Far end wall — clickable About the artist */}
      <AboutWall width={CORRIDOR_WIDTH} z={corridorLength} />

      {placed.map(({ artwork, position, rotationY }) => (
        <Painting
          key={artwork.id}
          artwork={artwork}
          position={position}
          rotationY={rotationY}
        />
      ))}

      <WalkControls bounds={bounds} initialYaw={Math.PI} />
    </>
  );
}
