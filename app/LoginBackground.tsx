'use client';
/**
 * LoginBackground.tsx — an original 3D WebGL backdrop for the auth pages.
 *
 * A slow, drifting field of glowing amber points in navy 3D space with gentle
 * depth, parallax on mouse move, and a soft central glow. Built with Three.js
 * loaded from a CDN (no build dependency). Entirely original — brand colors
 * only, no external art. Respects prefers-reduced-motion and degrades to a
 * static gradient if WebGL is unavailable.
 */
import { useEffect, useRef } from 'react';

/* Three.js is loaded from a CDN at runtime (not an npm dependency), so we type
   it loosely as `any` here rather than importing '@types/three'. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function LoginBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanup = () => {};
    let cancelled = false;

    // Load Three.js from CDN once.
    function loadThree(): Promise<any> {
      return new Promise((resolve) => {
        const w = window as any;
        if (w.THREE) return resolve(w.THREE);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s.onload = () => resolve((window as any).THREE);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }

    loadThree().then((THREE: any) => {
      if (!THREE || cancelled || !mountRef.current) return;

      const mount = mountRef.current;
      const W = () => mount.clientWidth;
      const H = () => mount.clientHeight;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0b1220, 0.055);

      const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 100);
      camera.position.z = 18;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W(), H());
      renderer.setClearColor(0x0b1220, 1);
      mount.appendChild(renderer.domElement);

      // --- Field of glowing points ---
      const COUNT = 900;
      const positions = new Float32Array(COUNT * 3);
      const speeds = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        speeds[i] = 0.2 + Math.random() * 0.6;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // Soft round amber sprite texture, drawn on a canvas.
      const tex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d')!;
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(245,179,1,1)');
        g.addColorStop(0.35, 'rgba(245,179,1,0.55)');
        g.addColorStop(1, 'rgba(245,179,1,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const t = new THREE.Texture(c);
        t.needsUpdate = true;
        return t;
      })();

      const mat = new THREE.PointsMaterial({
        size: 0.5,
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      // A faint second, dimmer layer for depth.
      const mat2 = mat.clone();
      mat2.size = 0.25;
      mat2.opacity = 0.35;
      const points2 = new THREE.Points(geo.clone(), mat2);
      points2.scale.set(1.6, 1.6, 1.6);
      scene.add(points2);

      // --- Interaction: gentle parallax on pointer move ---
      let targetX = 0, targetY = 0, curX = 0, curY = 0;
      const onMove = (e: PointerEvent) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      if (!reduce) window.addEventListener('pointermove', onMove);

      const onResize = () => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      };
      window.addEventListener('resize', onResize);

      let raf = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        raf = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Drift points slowly upward + wrap; subtle rotation of the whole field.
        const pos = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < COUNT; i++) {
          pos[i * 3 + 1] += speeds[i] * 0.01;
          if (pos[i * 3 + 1] > 20) pos[i * 3 + 1] = -20;
        }
        geo.attributes.position.needsUpdate = true;

        points.rotation.y = t * 0.03;
        points2.rotation.y = t * 0.02;

        // Ease parallax.
        curX += (targetX - curX) * 0.04;
        curY += (targetY - curY) * 0.04;
        camera.position.x = curX * 2.5;
        camera.position.y = -curY * 1.8;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', onResize);
        geo.dispose();
        mat.dispose();
        mat2.dispose();
        tex.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return <div ref={mountRef} className="loginbg" aria-hidden="true" />;
}