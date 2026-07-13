"use client";

import { Suspense } from "react";
import { Text } from "@react-three/drei";
import { TESTIMONIALS } from "@/lib/testimonials";

const WALL_HEIGHT = 5;

interface BackWallProps {
  width: number;
  z?: number;
}

/**
 * Wall behind the spawn point showing hardcoded collector reviews.
 * The viewer sees it when they turn around at the entrance.
 * Faces +Z (drei <Text> is readable from the +Z side by default).
 */
export function BackWall({ width, z = 0 }: BackWallProps) {
  const count = TESTIMONIALS.length;
  const cardW = Math.min(2.5, (width - 0.8) / count);
  const gap = (width - cardW * count) / (count + 1);
  const startX = -width / 2 + gap + cardW / 2;

  return (
    <group position={[0, 0, z]}>
      {/* Wall surface */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[width, WALL_HEIGHT]} />
        <meshStandardMaterial color="#efece5" roughness={0.95} />
      </mesh>

      {/* Section heading */}
      <Suspense fallback={null}>
        <Text
          position={[0, 4.1, 0.05]}
          fontSize={0.13}
          letterSpacing={0.28}
          color="#8b6842"
          anchorX="center"
          anchorY="middle"
        >
          REVIEWS
        </Text>
        <Text
          position={[0, 3.72, 0.05]}
          fontSize={0.34}
          color="#2a251f"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          In their words
        </Text>

        {TESTIMONIALS.map((t, i) => {
          const x = startX + i * (cardW + gap);
          return (
            <group key={i} position={[x, 0, 0]}>
              {/* Card panel */}
              <mesh position={[0, 1.95, 0.02]}>
                <planeGeometry args={[cardW, 3.1]} />
                <meshStandardMaterial color="#f7f5f0" roughness={0.9} />
              </mesh>
              {/* Thin accent line at top of card */}
              <mesh position={[0, 3.4, 0.03]}>
                <planeGeometry args={[0.4, 0.015]} />
                <meshStandardMaterial color="#8b6842" roughness={0.8} />
              </mesh>

              {/* Quote */}
              <Text
                position={[0, 3.2, 0.04]}
                fontSize={0.082}
                lineHeight={1.4}
                maxWidth={cardW - 0.35}
                color="#3a332b"
                anchorX="center"
                anchorY="top"
                textAlign="center"
              >
                {`“${t.quote}”`}
              </Text>

              {/* Attribution */}
              <Text
                position={[0, 0.85, 0.04]}
                fontSize={0.088}
                maxWidth={cardW - 0.3}
                color="#1c1a17"
                anchorX="center"
                anchorY="top"
                textAlign="center"
              >
                {t.name}
              </Text>
              <Text
                position={[0, 0.66, 0.04]}
                fontSize={0.06}
                letterSpacing={0.05}
                maxWidth={cardW - 0.3}
                color="#8a8175"
                anchorX="center"
                anchorY="top"
                textAlign="center"
              >
                {t.context}
              </Text>
            </group>
          );
        })}
      </Suspense>
    </group>
  );
}
