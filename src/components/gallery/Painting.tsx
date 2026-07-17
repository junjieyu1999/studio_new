"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Text, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
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

/**
 * Brass nameplate under the piece. It breathes on a 2s cycle so it reads as
 * interactive — visitors were not realising the artwork itself is clickable.
 */
function Plaque({
  artwork,
  hovered,
}: {
  artwork: Artwork;
  hovered: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!mat.current) return;
    // sin(pi * t) completes a full cycle every 2 seconds.
    const pulse = 0.5 + 0.5 * Math.sin(Math.PI * state.clock.elapsedTime);
    mat.current.emissiveIntensity = hovered ? 1.0 : 0.15 + pulse * 0.45;
  });

  return (
    <group position={[0, -1.72, 0.06]}>
      <mesh>
        <boxGeometry args={[1.9, 0.4, 0.045]} />
        <meshStandardMaterial
          ref={mat}
          color="#8a6a2f"
          emissive="#e8c874"
          emissiveIntensity={0.25}
          metalness={0.65}
          roughness={0.32}
        />
      </mesh>

      <Suspense fallback={null}>
        <Text
          position={[0, 0.07, 0.028]}
          fontSize={0.12}
          maxWidth={1.7}
          color="#1f1708"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
        >
          {artwork.title}
        </Text>
        <Text
          position={[0, -0.09, 0.028]}
          fontSize={0.062}
          letterSpacing={0.04}
          color="#3d2f14"
          anchorX="center"
          anchorY="middle"
        >
          {`${artwork.year} · ${artwork.medium}`}
        </Text>
        <Text
          position={[0, -0.31, 0.028]}
          fontSize={0.072}
          letterSpacing={0.06}
          color={hovered ? "#e8c874" : "#c9a45e"}
          anchorX="center"
          anchorY="middle"
        >
          {hovered ? "OPEN  →" : "VIEW DETAILS  →"}
        </Text>
      </Suspense>
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

      <Plaque artwork={artwork} hovered={hovered} />
    </group>
  );
}
