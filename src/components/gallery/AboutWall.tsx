"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Text, useTexture } from "@react-three/drei";

const WALL_HEIGHT = 5;
const IMG_MAX_H = 2.0;
const IMG_MAX_W = 1.7;

function ArtistPhoto() {
  const texture = useTexture("/artist-photo.jpg");
  const { w, h } = useMemo(() => {
    const img = texture.image as { width: number; height: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 0.8;
    let height = IMG_MAX_H;
    let width = height * aspect;
    if (width > IMG_MAX_W) {
      width = IMG_MAX_W;
      height = width / aspect;
    }
    return { w: width, h: height };
  }, [texture]);

  return (
    <group position={[0, 3.05, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[w + 0.12, h + 0.12]} />
        <meshStandardMaterial color="#1c1a17" roughness={0.6} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  );
}

function PhotoFallback() {
  return (
    <mesh position={[0, 3.05, 0]}>
      <planeGeometry args={[1.4, 1.9]} />
      <meshStandardMaterial color="#8a8175" roughness={0.9} />
    </mesh>
  );
}

interface AboutWallProps {
  z: number;
  width: number;
}

/**
 * Far-end wall: artist photo + short intro that routes to /about on click.
 * Rotated 180° so its content faces the approaching viewer (world -Z).
 */
export function AboutWall({ z, width }: AboutWallProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      {/* Wall surface */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[width, WALL_HEIGHT]} />
        <meshStandardMaterial color="#efece5" roughness={0.95} />
      </mesh>

      {/* Clickable content */}
      <group
        scale={hovered ? 1.02 : 1}
        onClick={(e) => {
          e.stopPropagation();
          router.push("/about");
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
        {/* Transparent hit area so the whole panel is clickable (must stay
            renderable — three.js skips raycasting on visible={false} meshes) */}
        <mesh position={[0, 2.0, 0.01]}>
          <planeGeometry args={[width * 0.7, 4.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Suspense fallback={<PhotoFallback />}>
          <ArtistPhoto />
        </Suspense>

        <Suspense fallback={null}>
          <Text
            position={[0, 1.72, 0.05]}
            fontSize={0.1}
            letterSpacing={0.28}
            color="#8b6842"
            anchorX="center"
            anchorY="middle"
          >
            ABOUT THE ARTIST
          </Text>
          <Text
            position={[0, 1.4, 0.05]}
            fontSize={0.34}
            color="#1c1a17"
            anchorX="center"
            anchorY="middle"
          >
            Yu Jun Jie
          </Text>
          <Text
            position={[0, 0.95, 0.05]}
            fontSize={0.082}
            lineHeight={1.5}
            maxWidth={4.2}
            color="#3a332b"
            anchorX="center"
            anchorY="top"
            textAlign="center"
          >
            {"Artist based in Singapore, working in portraits and landscapes — chasing the tension inside stillness and the gray areas where the real human story lives."}
          </Text>
          <Text
            position={[0, 0.35, 0.05]}
            fontSize={0.1}
            letterSpacing={0.05}
            color={hovered ? "#8b6842" : "#6a6155"}
            anchorX="center"
            anchorY="middle"
          >
            {hovered ? "Enter the studio  →" : "Read more  →"}
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
