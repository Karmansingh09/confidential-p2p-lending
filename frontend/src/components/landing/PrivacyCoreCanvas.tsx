import React, { useEffect, useRef, useState } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  phase: 'incoming' | 'core' | 'outgoing';
  life: number;
  maxLife: number;
}

export const PrivacyCoreCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseCurrentRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3D Polyhedral Geometry (A faceted architectural core with inner and outer lattices)
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const rawVertices: Point3D[] = [
      { x: -1, y: phi, z: 0 },
      { x: 1, y: phi, z: 0 },
      { x: -1, y: -phi, z: 0 },
      { x: 1, y: -phi, z: 0 },
      { x: 0, y: -1, z: phi },
      { x: 0, y: 1, z: phi },
      { x: 0, y: -1, z: -phi },
      { x: 0, y: 1, z: -phi },
      { x: phi, y: 0, z: -1 },
      { x: phi, y: 0, z: 1 },
      { x: -phi, y: 0, z: -1 },
      { x: -phi, y: 0, z: 1 },
    ];

    // Normalize vertices to unit sphere
    const vertices: Point3D[] = rawVertices.map((v) => {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    });

    // 20 Triangular faces of an icosahedron
    const faces: number[][] = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];

    // Particles system: representing private inputs entering -> core proof -> verification signal
    const particles: Particle3D[] = [];
    const numParticles = 68;

    for (let i = 0; i < numParticles; i++) {
      const phase = i < 22 ? 'incoming' : i < 48 ? 'core' : 'outgoing';
      particles.push(createParticle(phase));
    }

    function createParticle(phase: 'incoming' | 'core' | 'outgoing'): Particle3D {
      const maxLife = 180 + Math.random() * 120;
      if (phase === 'incoming') {
        return {
          x: -1.6 - Math.random() * 0.4,
          y: (Math.random() - 0.5) * 0.8,
          z: (Math.random() - 0.5) * 0.8,
          vx: 0.009 + Math.random() * 0.006,
          vy: (Math.random() - 0.5) * 0.003,
          vz: (Math.random() - 0.5) * 0.003,
          size: 2.0 + Math.random() * 1.6,
          alpha: 0.4 + Math.random() * 0.4,
          phase: 'incoming',
          life: 0,
          maxLife,
        };
      } else if (phase === 'core') {
        const theta = Math.random() * Math.PI * 2;
        const phiAngle = Math.acos(2 * Math.random() - 1);
        const r = 0.15 + Math.random() * 0.6;
        return {
          x: r * Math.sin(phiAngle) * Math.cos(theta),
          y: r * Math.sin(phiAngle) * Math.sin(theta),
          z: r * Math.cos(phiAngle),
          vx: (Math.random() - 0.5) * 0.003,
          vy: (Math.random() - 0.5) * 0.003,
          vz: (Math.random() - 0.5) * 0.003,
          size: 1.6 + Math.random() * 2.0,
          alpha: 0.5 + Math.random() * 0.4,
          phase: 'core',
          life: Math.random() * maxLife,
          maxLife,
        };
      } else {
        return {
          x: 0.4 + Math.random() * 0.2,
          y: (Math.random() - 0.5) * 0.5,
          z: (Math.random() - 0.5) * 0.5,
          vx: 0.008 + Math.random() * 0.006,
          vy: (Math.random() - 0.5) * 0.002,
          vz: (Math.random() - 0.5) * 0.002,
          size: 2.2 + Math.random() * 1.8,
          alpha: 0.7 + Math.random() * 0.3,
          phase: 'outgoing',
          life: 0,
          maxLife,
        };
      }
    }

    // Canvas sizing with Retina scale
    const resizeCanvas = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse movement handler for subtle parallax
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseTargetRef.current = { x: x * 0.5, y: y * 0.5 };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Visibility Observer to pause when not visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible && prefersReducedMotion) {
            drawFrame(0);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Rotation angles
    let rotX = 0.35;
    let rotY = 0.75;
    let rotZ = 0.1;
    let time = 0;

    const drawFrame = (currentTime: number) => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(drawFrame);
        return;
      }

      time += 0.016;

      // Smooth mouse lerp
      mouseCurrentRef.current.x += (mouseTargetRef.current.x - mouseCurrentRef.current.x) * 0.05;
      mouseCurrentRef.current.y += (mouseTargetRef.current.y - mouseCurrentRef.current.y) * 0.05;

      const rect = containerRef.current?.getBoundingClientRect();
      const width = rect?.width || 540;
      const height = rect?.height || 540;
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const minDim = Math.min(width, height);

      // Base radius scaled so the core fills 45-50% of the column (approx 500-540px diameter on 1440px desktop)
      const baseRadius = minDim * 0.40;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Subtle breathing floating motion
      const floatY = Math.sin(time * 0.7) * 7;
      const effectiveCenterY = centerY + floatY;

      // Rotations: very slow continuous rotation + mouse tilt
      if (!prefersReducedMotion) {
        rotY += 0.002;
        rotX += 0.001;
        rotZ += 0.0005;
      }

      const effectiveRotX = rotX + mouseCurrentRef.current.y * 0.35;
      const effectiveRotY = rotY + mouseCurrentRef.current.x * 0.35;

      // 3D Rotation Matrix Calculation
      const cosX = Math.cos(effectiveRotX);
      const sinX = Math.sin(effectiveRotX);
      const cosY = Math.cos(effectiveRotY);
      const sinY = Math.sin(effectiveRotY);
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);

      const transformPoint = (p: Point3D): Point3D => {
        // Rotate Y
        let x1 = p.x * cosY + p.z * sinY;
        let y1 = p.y;
        let z1 = -p.x * sinY + p.z * cosY;

        // Rotate X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Rotate Z
        let x3 = x2 * cosZ - y2 * sinZ;
        let y3 = x2 * sinZ + y2 * cosZ;
        let z3 = z2;

        return { x: x3, y: y3, z: z3 };
      };

      const project = (p: Point3D, scaleFactor = 1.0) => {
        const fov = 3.8;
        const z = p.z + fov;
        const scale = (fov / z) * (baseRadius * scaleFactor);
        return {
          x: centerX + p.x * scale,
          y: effectiveCenterY + p.y * scale,
          scale,
          z: p.z,
        };
      };

      // 1. Draw subtle ambient glow behind the core
      const glowGrad = ctx.createRadialGradient(
        centerX,
        effectiveCenterY,
        20,
        centerX,
        effectiveCenterY,
        baseRadius * 1.45
      );
      glowGrad.addColorStop(0, 'rgba(24, 38, 68, 0.42)');
      glowGrad.addColorStop(0.5, 'rgba(13, 20, 36, 0.22)');
      glowGrad.addColorStop(1, 'rgba(7, 10, 16, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw outer orbital refraction rings (contained within bounds)
      ctx.save();
      ctx.strokeStyle = 'rgba(159, 184, 216, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        centerX,
        effectiveCenterY,
        baseRadius * 1.18,
        baseRadius * 0.55,
        effectiveRotY * 0.3,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.strokeStyle = 'rgba(159, 184, 216, 0.10)';
      ctx.beginPath();
      ctx.ellipse(
        centerX,
        effectiveCenterY,
        baseRadius * 1.28,
        baseRadius * 0.38,
        -effectiveRotX * 0.4,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();

      // 3. Transform geometry vertices
      const transformedVerts = vertices.map(transformPoint);
      const projectedVerts = transformedVerts.map((v) => project(v, 1.0));

      // Inner core vertices (scaled down to 0.55 for concentric smoked chamber)
      const innerProjectedVerts = transformedVerts.map((v) => project(v, 0.55));

      // 4. Update and draw particles (Private Input stream -> Core -> Verified Outcome)
      if (!prefersReducedMotion) {
        particles.forEach((p, idx) => {
          p.life++;
          p.x += p.vx;
          p.y += p.vy;
          p.z += p.vz;

          if (p.phase === 'incoming') {
            // Accelerate towards core
            p.vx += 0.0003;
            if (p.x >= -0.2) {
              // Transition into core
              particles[idx] = createParticle('core');
            }
          } else if (p.phase === 'core') {
            // Gentle orbital turbulence inside core
            p.x += Math.sin(time * 2 + idx) * 0.0025;
            p.y += Math.cos(time * 2 + idx) * 0.0025;
            if (p.life > p.maxLife) {
              // Emit as verified signal
              particles[idx] = createParticle(Math.random() > 0.45 ? 'outgoing' : 'incoming');
            }
          } else if (p.phase === 'outgoing') {
            // Accelerate outwards to the right, fading out before the border
            p.vx += 0.0004;
            if (p.x > 1.25 || p.life > p.maxLife) {
              particles[idx] = createParticle('incoming');
            }
          }
        });
      }

      // Draw particles sorted by Z
      particles.forEach((p) => {
        const tp = transformPoint(p);
        const proj = project(tp);

        let currentAlpha = p.alpha;
        if (p.phase === 'incoming') {
          // Fade in as it moves toward core
          currentAlpha *= Math.min(1, Math.max(0, (p.x + 1.6) / 0.5));
        } else if (p.phase === 'outgoing') {
          // Fade out smoothly before reaching column boundary
          currentAlpha *= Math.max(0, 1 - (p.x - 0.4) / 0.85);
        }

        ctx.save();
        if (p.phase === 'incoming') {
          // Crisp silver / ice white (private data entering)
          ctx.fillStyle = `rgba(242, 244, 247, ${currentAlpha * 0.75})`;
          ctx.shadowColor = 'rgba(242, 244, 247, 0.4)';
          ctx.shadowBlur = 4;
        } else if (p.phase === 'core') {
          // Muted Ice Blue (transforming inside core)
          ctx.fillStyle = `rgba(159, 184, 216, ${currentAlpha * 0.85})`;
          ctx.shadowColor = 'rgba(159, 184, 216, 0.5)';
          ctx.shadowBlur = 6;
        } else {
          // Luminous Ice highlight (coherent verified signal)
          ctx.fillStyle = `rgba(215, 229, 245, ${currentAlpha * 0.9})`;
          ctx.shadowColor = 'rgba(215, 229, 245, 0.75)';
          ctx.shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, p.size * (proj.scale / baseRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 5. Depth sort polygonal faces for smoked glass rendering
      const sortedFaces = faces
        .map((faceIndices) => {
          const v0 = transformedVerts[faceIndices[0]];
          const v1 = transformedVerts[faceIndices[1]];
          const v2 = transformedVerts[faceIndices[2]];

          // Surface normal for backface culling & lighting calculation
          const ax = v1.x - v0.x;
          const ay = v1.y - v0.y;
          const az = v1.z - v0.z;
          const bx = v2.x - v0.x;
          const by = v2.y - v0.y;
          const bz = v2.z - v0.z;

          const nx = ay * bz - az * by;
          const ny = az * bx - ax * bz;
          const nz = ax * by - ay * bx;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          const normalZ = nz / len;

          const avgZ = (v0.z + v1.z + v2.z) / 3;

          return {
            indices: faceIndices,
            avgZ,
            normalZ,
          };
        })
        .sort((a, b) => a.avgZ - b.avgZ); // Back to front

      // 6. Draw Inner Faceted Lattice (Core Chamber)
      ctx.save();
      ctx.strokeStyle = 'rgba(159, 184, 216, 0.28)';
      ctx.lineWidth = 1;
      sortedFaces.forEach(({ indices, normalZ }) => {
        if (normalZ > -0.2) {
          const p0 = innerProjectedVerts[indices[0]];
          const p1 = innerProjectedVerts[indices[1]];
          const p2 = innerProjectedVerts[indices[2]];

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(20, 28, 44, ${Math.max(0.12, 0.5 * Math.abs(normalZ))})`;
          ctx.fill();
          ctx.stroke();
        }
      });
      ctx.restore();

      // 7. Draw Outer Smoked Glass Polyhedron
      sortedFaces.forEach(({ indices, normalZ }) => {
        const p0 = projectedVerts[indices[0]];
        const p1 = projectedVerts[indices[1]];
        const p2 = projectedVerts[indices[2]];

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        // If face is pointing towards camera
        if (normalZ > 0) {
          // Semi-transparent smoked blue glass with deep blue tint & specular refraction
          const alpha = 0.28 + 0.38 * normalZ;
          ctx.fillStyle = `rgba(13, 17, 26, ${alpha})`;
          ctx.fill();

          // Crisp crystalline icy-blue edge highlight
          ctx.strokeStyle = `rgba(159, 184, 216, ${0.22 + 0.4 * normalZ})`;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          // Subtle internal specular reflection on top facet (silver-to-ice gradient)
          if (normalZ > 0.6) {
            const specGrad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p2.y);
            specGrad.addColorStop(0, 'rgba(242, 244, 247, 0.18)');
            specGrad.addColorStop(1, 'rgba(159, 184, 216, 0)');
            ctx.fillStyle = specGrad;
            ctx.fill();
          }
        } else {
          // Back faces: faint smoked blue edges visible through translucent front
          ctx.fillStyle = 'rgba(7, 10, 16, 0.22)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(159, 184, 216, 0.1)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
        ctx.restore();
      });

      // 8. Draw Emergent Verification Signal Pulse on the Right (fully contained)
      const pulseT = (time * 1.3) % 2.4;
      if (pulseT < 1.6) {
        const pulseR = baseRadius * (0.05 + pulseT * 0.2);
        const pulseAlpha = Math.max(0, 0.45 * (1 - pulseT / 1.6));
        const pulseOriginX = centerX + baseRadius * 0.65;
        const pulseOriginY = effectiveCenterY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pulseOriginX, pulseOriginY, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(159, 184, 216, ${pulseAlpha})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    animationFrameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="privacy-core-viewport" aria-label="The Privacy Core visual representation">
      <canvas ref={canvasRef} className="privacy-core-canvas" />

      {/* Floating Micro-Labels positioned around the Privacy Core (Section 13) */}
      <div className="core-micro-label core-label-input" aria-hidden="true">
        <div className="micro-label-header">
          <span className="micro-status-dot dot-input" />
          <span className="micro-label-tag">PRIVATE INPUT</span>
        </div>
        <span className="micro-label-val">Hidden</span>
      </div>

      <div className="core-micro-label core-label-proof" aria-hidden="true">
        <div className="micro-label-header">
          <span className="micro-status-dot dot-proof" />
          <span className="micro-label-tag">PRIVATE PROOF</span>
        </div>
        <span className="micro-label-val">Processed privately</span>
      </div>

      <div className="core-micro-label core-label-outcome" aria-hidden="true">
        <div className="micro-label-header">
          <span className="micro-status-dot dot-outcome" />
          <span className="micro-label-tag">PUBLIC OUTCOME</span>
        </div>
        <span className="micro-label-val">Eligibility verified</span>
      </div>
    </div>
  );
};
