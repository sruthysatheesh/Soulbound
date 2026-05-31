'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import { Timer } from 'three-stdlib';
import * as THREE from 'three';

/* ─── Silver/Chrome Materials ─────────────────────── */
const heroMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8c8c8'),
    emissive: new THREE.Color('#1a1a1a'),
    emissiveIntensity: 0.1,
    metalness: 0.9,
    roughness: 0.12,
    envMapIntensity: 2.0,
});

const sidebarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b0b0b0'),
    emissive: new THREE.Color('#111111'),
    emissiveIntensity: 0.08,
    metalness: 0.85,
    roughness: 0.18,
    envMapIntensity: 1.5,
});

/* ─── Model Component ────────────────────────────── */
function Model({ mode }: { mode: 'hero' | 'sidebar' }) {
    const { scene } = useGLTF('/voronoi/scene.gltf');
    const modelRef = useRef<THREE.Group>(null);
    const timerRef = useRef(new Timer());

    const mat = mode === 'hero' ? heroMaterial : sidebarMaterial;
    const rotSpeed = mode === 'hero' ? 0.22 : 0.45;

    const clonedScene = useMemo(() => {
        const group = new THREE.Group();
        const cloned = scene.clone(true);
        cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = mat;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });

        // Center the geometry's pivot point
        const box = new THREE.Box3().setFromObject(cloned);
        const center = box.getCenter(new THREE.Vector3());
        
        // Offset the mesh so its center is at (0,0,0) relative to the parent group
        cloned.position.x = -center.x;
        cloned.position.y = -center.y;
        cloned.position.z = -center.z;

        group.add(cloned);
        return group;
    }, [scene, mat]);

    useFrame(() => {
        timerRef.current.update();
        const delta = timerRef.current.getDelta();
        if (modelRef.current) {
            modelRef.current.rotation.y += delta * rotSpeed;
            modelRef.current.rotation.x += delta * (rotSpeed * 0.7); // Rotate around horizontal axis too
            // Removed the position.y bobbing animation so it stays fixed to origin
        }
    });

    return (
        <primitive
            ref={modelRef}
            object={clonedScene}
            scale={mode === 'hero' ? [3.8, 3.8, 3.8] : [2.0, 2.0, 2.0]} // Increased model size significantly
            position={[0, 0, 0]}
            dispose={null}
        />
    );
}

useGLTF.preload('/voronoi/scene.gltf');

/* ─── Hero variant — large, dramatic silver ──────── */
export function VoronoiHero() {
    return (
        <Canvas
            camera={{ position: [0, 0, 5], fov: 42 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
            shadows
        >
            {/* Elegant neutral lighting */}
            <ambientLight intensity={0.5} color="#aaaaaa" />
            <pointLight position={[5, 8, 5]}   intensity={60} color="#ffffff" castShadow />
            <pointLight position={[-6, -4, 4]} intensity={25} color="#cccccc" />
            <pointLight position={[0, 8, -6]}  intensity={18} color="#e0e0e0" />
            <pointLight position={[4, -6, 2]}  intensity={20} color="#b0b0b0" />

            <Model mode="hero" />

            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate={false}
                dampingFactor={0.05}
                enableDamping
                rotateSpeed={0.6}
            />
        </Canvas>
    );
}

/* ─── Default export ─────────────────────────────── */
export default function VoronoiCube() {
    return <VoronoiHero />;
}
