"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";
import { WALL_COLOR } from "@/lib/gallery-theme";

const WALL_HEIGHT = 5;
const INTERVAL_MS = 10000; // time each review is shown
const TRANSITION_S = 0.6; // swipe duration
const SLIDE = 5.5; // how far a card travels when swiping

const easeInOut = (x: number) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function ReviewCard({ t, cardW }: { t: Testimonial; cardW: number }) {
  return (
    <group>
      {/* Card panel */}
      <mesh position={[0, 1.95, 0.02]}>
        <planeGeometry args={[cardW, 3.1]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.9} />
      </mesh>
      {/* Accent line */}
      <mesh position={[0, 3.35, 0.03]}>
        <planeGeometry args={[0.5, 0.016]} />
        <meshStandardMaterial color="#8b6842" roughness={0.8} />
      </mesh>

      <Suspense fallback={null}>
        <Text
          position={[0, 3.1, 0.04]}
          fontSize={0.12}
          lineHeight={1.45}
          maxWidth={cardW - 0.7}
          color="#3a332b"
          anchorX="center"
          anchorY="top"
          textAlign="center"
        >
          {`“${t.quote}”`}
        </Text>
        <Text
          position={[0, 0.98, 0.04]}
          fontSize={0.12}
          maxWidth={cardW - 0.5}
          color="#1c1a17"
          anchorX="center"
          anchorY="top"
          textAlign="center"
        >
          {t.name}
        </Text>
        <Text
          position={[0, 0.76, 0.04]}
          fontSize={0.07}
          letterSpacing={0.05}
          maxWidth={cardW - 0.5}
          color="#8a8175"
          anchorX="center"
          anchorY="top"
          textAlign="center"
        >
          {t.context}
        </Text>
      </Suspense>
    </group>
  );
}

interface BackWallProps {
  width: number;
  z?: number;
}

/**
 * Wall behind the spawn point. Shows collector reviews as an auto-advancing
 * carousel — the current review swipes out to the left and the next swipes in
 * from the right every 10 seconds. Faces +Z (viewer turns around to see it).
 */
export function BackWall({ width, z = 0 }: BackWallProps) {
  const cardW = Math.min(4.4, width - 1.4);
  const count = TESTIMONIALS.length;

  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const indexRef = useRef(0);
  const progress = useRef(0);
  const currentRef = useRef<THREE.Group>(null);
  const prevRef = useRef<THREE.Group>(null);

  // Auto-advance
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      const cur = indexRef.current;
      const next = (cur + 1) % count;
      progress.current = 0;
      setPrev(cur);
      indexRef.current = next;
      setIndex(next);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [count]);

  useFrame((_, delta) => {
    if (prev === null) {
      if (currentRef.current) currentRef.current.position.x = 0;
      return;
    }
    progress.current = Math.min(1, progress.current + delta / TRANSITION_S);
    const p = easeInOut(progress.current);
    if (prevRef.current) prevRef.current.position.x = -p * SLIDE;
    if (currentRef.current) currentRef.current.position.x = (1 - p) * SLIDE;
    if (progress.current >= 1) setPrev(null);
  });

  return (
    <group position={[0, 0, z]}>
      {/* Wall surface */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[width, WALL_HEIGHT]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </mesh>

      {/* Heading */}
      <Suspense fallback={null}>
        <Text
          position={[0, 4.2, 0.05]}
          fontSize={0.13}
          letterSpacing={0.28}
          color="#8b6842"
          anchorX="center"
          anchorY="middle"
        >
          REVIEWS
        </Text>
        <Text
          position={[0, 3.82, 0.05]}
          fontSize={0.34}
          color="#2a251f"
          anchorX="center"
          anchorY="middle"
        >
          In their words
        </Text>
      </Suspense>

      {/* Current card */}
      <group ref={currentRef}>
        <ReviewCard t={TESTIMONIALS[index]} cardW={cardW} />
      </group>

      {/* Outgoing card (only during a swipe) */}
      {prev !== null && (
        <group ref={prevRef}>
          <ReviewCard t={TESTIMONIALS[prev]} cardW={cardW} />
        </group>
      )}

      {/* Position dots */}
      {count > 1 &&
        TESTIMONIALS.map((_, i) => {
          const spacing = 0.28;
          const x = (i - (count - 1) / 2) * spacing;
          return (
            <mesh key={i} position={[x, 0.28, 0.05]}>
              <circleGeometry args={[0.05, 20]} />
              <meshStandardMaterial
                color={i === index ? "#8b6842" : "#c9c3b6"}
                roughness={0.8}
              />
            </mesh>
          );
        })}
    </group>
  );
}
