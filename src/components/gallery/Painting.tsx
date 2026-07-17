"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Artwork } from "@/types/artwork";

const MAX_HEIGHT = 2.6;
const MIN_WIDTH = 1.5;
const MAX_WIDTH = 3.4;

// Dark antique-gold frame — reads golden under the warm gallery lights.
const FRAME_COLOR = "#8a6a2f";
const FRAME_DARK = "#3b2c15";
const RAIL_T = 0.17; // rail thickness (visible border width)
const RAIL_D = 0.18; // rail depth — how far the frame stands off the wall

/**
 * Frame built from four real rails that project forward past the canvas, so it
 * catches the light and casts a proper edge instead of reading as a flat panel.
 */
function Frame({ w, h }: { w: number; h: number }) {
  const z = RAIL_D / 2 - 0.04; // rails end up proud of the canvas plane
  const rail = (
    <meshStandardMaterial color={FRAME_COLOR} metalness={0.55} roughness={0.35} />
  );

  return (
    <group>
      {/* recessed backing board / inner rebate */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[w + RAIL_T * 2, h + RAIL_T * 2, 0.06]} />
        <meshStandardMaterial color={FRAME_DARK} roughness={0.65} metalness={0.2} />
      </mesh>

      {/* top / bottom */}
      <mesh position={[0, h / 2 + RAIL_T / 2, z]}>
        <boxGeometry args={[w + RAIL_T * 2, RAIL_T, RAIL_D]} />
        {rail}
      </mesh>
      <mesh position={[0, -(h / 2 + RAIL_T / 2), z]}>
        <boxGeometry args={[w + RAIL_T * 2, RAIL_T, RAIL_D]} />
        {rail}
      </mesh>

      {/* left / right */}
      <mesh position={[-(w / 2 + RAIL_T / 2), 0, z]}>
        <boxGeometry args={[RAIL_T, h, RAIL_D]} />
        {rail}
      </mesh>
      <mesh position={[w / 2 + RAIL_T / 2, 0, z]}>
        <boxGeometry args={[RAIL_T, h, RAIL_D]} />
        {rail}
      </mesh>
    </group>
  );
}

function ArtworkTexturePlane({ artwork }: { artwork: Artwork }) {
  const texture = useTexture(artwork.image_url as string);
  const { width, height } = useMemo(() => {
    const img = texture.image as { width: number; height: number };
    const aspect = img?.width && img?.height ? img.width / img.height : 0.8;
    let h = MAX_HEIGHT;
    let w = h * aspect;
    if (w > MAX_WIDTH) {
      w = MAX_WIDTH;
      h = w / aspect;
    } else if (w < MIN_WIDTH) {
      w = MIN_WIDTH;
      h = w / aspect;
    }
    // Keep the top edge predictable so the title/label sit consistently.
    if (h > MAX_HEIGHT) {
      h = MAX_HEIGHT;
      w = h * aspect;
    }
    return { width: w, height: h };
  }, [texture]);

  return (
    <group>
      <Frame w={width} h={height} />
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  );
}

function GradientFallback({ artwork }: { artwork: Artwork }) {
  const width = artwork.theme === "portrait" ? 1.8 : 3.0;
  const height = artwork.theme === "portrait" ? 2.6 : 1.9;

  return (
    <group>
      <Frame w={width} h={height} />
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#8a8a8a" roughness={0.9} />
      </mesh>
    </group>
  );
}

interface PaintingProps {
  artwork: Artwork;
  position: [number, number, number];
  rotationY: number;
}

export function Painting({ artwork, position, rotationY }: PaintingProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={hovered ? 1.035 : 1}
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/artwork/${artwork.id}`);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <Suspense fallback={<GradientFallback artwork={artwork} />}>
        {artwork.image_url ? (
          <ArtworkTexturePlane artwork={artwork} />
        ) : (
          <GradientFallback artwork={artwork} />
        )}
      </Suspense>

      {/* Title + details above the painting (light text for dark walls) */}
      <Suspense fallback={null}>
        <Text
          position={[0, 1.62, 0.02]}
          fontSize={0.16}
          color={hovered ? "#e8c874" : "#f2ece0"}
          anchorX="center"
          anchorY="bottom"
          maxWidth={3.2}
          textAlign="center"
        >
          {artwork.title}
        </Text>
        <Text
          position={[0, 1.5, 0.02]}
          fontSize={0.088}
          letterSpacing={0.02}
          color="#b6ad9d"
          anchorX="center"
          anchorY="top"
        >
          {`${artwork.year} · ${artwork.medium}`}
        </Text>
      </Suspense>
    </group>
  );
}
