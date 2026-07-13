"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Artwork } from "@/types/artwork";

const MAX_HEIGHT = 2.6;
const MIN_WIDTH = 1.5;
const MAX_WIDTH = 3.4;

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
    return { width: w, height: h };
  }, [texture]);

  return (
    <group>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[width + 0.18, height + 0.18, 0.06]} />
        <meshStandardMaterial color="#1c1a17" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
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
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[width + 0.18, height + 0.18, 0.06]} />
        <meshStandardMaterial color="#1c1a17" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
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

      <Suspense fallback={null}>
        <Text
          position={[0, -1.55, 0.02]}
          fontSize={0.14}
          color={hovered ? "#e8c874" : "#f5f2ea"}
          anchorX="center"
          anchorY="top"
          maxWidth={2.6}
        >
          {artwork.title}
        </Text>
        <Text
          position={[0, -1.78, 0.02]}
          fontSize={0.09}
          color="#b8b3a8"
          anchorX="center"
          anchorY="top"
        >
          {`${artwork.year} · ${artwork.medium}`}
        </Text>
      </Suspense>
    </group>
  );
}
