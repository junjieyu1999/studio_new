"use client";

import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { initKeyboardMovement, pressedKeys } from "@/lib/movement-keys";
import {
  cancelGuidedNav,
  guidedNav,
  nearestIndex,
} from "@/lib/guided-nav";

interface WalkControlsProps {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  eyeHeight?: number;
  speed?: number;
  initialYaw?: number;
}

export function WalkControls({
  bounds,
  eyeHeight = 1.6,
  speed = 3.4,
  initialYaw = 0,
}: WalkControlsProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(initialYaw);
  const pitch = useRef(0);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => initKeyboardMovement(), []);

  useEffect(() => {
    const el = gl.domElement;

    // NOTE: the canvas needs `touch-action: none` for drag-to-look to work on
    // touch — that's set via the `.gallery-stage canvas` rule in globals.css.
    const onPointerDown = (e: PointerEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * 0.0035;
      pitch.current -= dy * 0.0035;
      pitch.current = Math.max(-1.1, Math.min(1.1, pitch.current));
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging.current = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
    };
  }, [gl]);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  /* eslint-disable react-hooks/immutability -- mutating the R3F camera in
     useFrame (rather than setState) is the standard react-three-fiber
     pattern for per-frame updates. */
  useFrame((_, delta) => {
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch.current, yaw.current, 0);

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.set(forward.current.z, 0, -forward.current.x);

    move.current.set(0, 0, 0);
    if (pressedKeys.has("w") || pressedKeys.has("arrowup")) move.current.add(forward.current);
    if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) move.current.sub(forward.current);
    if (pressedKeys.has("d") || pressedKeys.has("arrowright")) move.current.add(right.current);
    if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) move.current.sub(right.current);

    if (move.current.lengthSq() > 0) {
      // Any manual input cancels an in-progress guided glide.
      cancelGuidedNav();
      move.current.normalize().multiplyScalar(speed * delta);
      camera.position.add(move.current);
    } else if (guidedNav.targetZ !== null) {
      // Smoothly glide toward the target station (framerate-independent).
      const t = 1 - Math.pow(0.0015, delta);
      camera.position.z += (guidedNav.targetZ - camera.position.z) * t;
      camera.position.x += (0 - camera.position.x) * t; // recenter in corridor
      if (Math.abs(guidedNav.targetZ - camera.position.z) < 0.03) {
        camera.position.z = guidedNav.targetZ;
        cancelGuidedNav();
      }
    }

    camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x));
    camera.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z));
    camera.position.y = eyeHeight;

    // Keep the current-station index in sync with where the viewer actually is,
    // so the Prev/Next buttons always step relative to their real position.
    if (guidedNav.targetZ === null && guidedNav.stops.length > 0) {
      guidedNav.index = nearestIndex(camera.position.z);
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
