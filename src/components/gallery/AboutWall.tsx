"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Text, useTexture } from "@react-three/drei";
import { WALL_COLOR } from "@/lib/gallery-theme";

const WALL_HEIGHT = 5;
const IMG_MAX_H = 3.0;
const IMG_MAX_W = 2.5;

// Layout columns (local space; the wall is rotated 180° so local-left reads as
// the viewer's left). Photo on the left, text block on the right.
const PHOTO_X = -1.95;
const PHOTO_Y = 2.55;
const TEXT_X = 0.35;
const TEXT_MAXW = 3.35;

function ArtistPhoto() {
  const texture = useTexture("/artist-photo.jpg");
  const { w, h } = useMemo(() => {
    const img = texture.image as { width: number; height: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 0.78;
    let height = IMG_MAX_H;
    let width = height * aspect;
    if (width > IMG_MAX_W) {
      width = IMG_MAX_W;
      height = width / aspect;
    }
    return { w: width, h: height };
  }, [texture]);

  return (
    <group position={[PHOTO_X, PHOTO_Y, 0.06]}>
      {/* Gold frame sits just behind the photo */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[w + 0.16, h + 0.16]} />
        <meshStandardMaterial color="#8a6a2f" metalness={0.45} roughness={0.4} />
      </mesh>
      {/* Photo, pushed clearly off the wall to avoid z-fighting */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  );
}

function PhotoFallback() {
  return (
    <mesh position={[PHOTO_X, PHOTO_Y, 0.05]}>
      <planeGeometry args={[2.3, 3.0]} />
      <meshStandardMaterial color="#8a8175" roughness={0.9} />
    </mesh>
  );
}

interface AboutWallProps {
  z: number;
  width: number;
}

/**
 * Far-end wall: big artist photo (left) + short intro (right) that routes to
 * /about on click. Rotated 180° so its content faces the approaching viewer.
 */
export function AboutWall({ z, width }: AboutWallProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      {/* Wall surface */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[width, WALL_HEIGHT]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
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
        <mesh position={[0, 2.5, 0.12]}>
          <planeGeometry args={[width * 0.92, 3.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Suspense fallback={<PhotoFallback />}>
          <ArtistPhoto />
        </Suspense>

        {/* Right-hand text column, left-aligned */}
        <Suspense fallback={null}>
          <Text
            position={[TEXT_X, 3.75, 0.06]}
            fontSize={0.1}
            letterSpacing={0.28}
            color="#8b6842"
            anchorX="left"
            anchorY="top"
          >
            ABOUT THE ARTIST
          </Text>
          <Text
            position={[TEXT_X, 3.5, 0.06]}
            fontSize={0.44}
            color="#1c1a17"
            anchorX="left"
            anchorY="top"
          >
            Yu Jun Jie
          </Text>
          <Text
            position={[TEXT_X, 2.85, 0.06]}
            fontSize={0.11}
            lineHeight={1.55}
            maxWidth={TEXT_MAXW}
            color="#3a332b"
            anchorX="left"
            anchorY="top"
          >
            {"Artist based in Singapore, working in portraits and landscapes — chasing the tension inside stillness and the gray areas where the real human story lives."}
          </Text>
          <Text
            position={[TEXT_X, 1.55, 0.06]}
            fontSize={0.12}
            letterSpacing={0.05}
            color={hovered ? "#8b6842" : "#6a6155"}
            anchorX="left"
            anchorY="top"
          >
            {hovered ? "Enter the studio  →" : "Read more  →"}
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
