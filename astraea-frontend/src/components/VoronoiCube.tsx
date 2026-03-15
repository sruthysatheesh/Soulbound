'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { Timer } from 'three-stdlib';
import * as THREE from 'three';

const tealMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#116466'),
    emissive: new THREE.Color('#2C3531'),
    emissiveIntensity: 0.15,
    metalness: 0.7,
    roughness: 0.25,
    envMapIntensity: 1.2,
});

function Model() {
    const { scene } = useGLTF('/strange_shapes/scene.gltf');
    const modelRef = useRef<THREE.Group>(null);
    const timerRef = useRef(new Timer());

    const clonedScene = useMemo(() => {
        const cloned = scene.clone(true);
        cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = tealMaterial;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return cloned;
    }, [scene]);

    useFrame(() => {
        timerRef.current.update();
        const delta = timerRef.current.getDelta();
        if (modelRef.current) {
            modelRef.current.rotation.y += delta * 0.35;
        }
    });

    return (
        <primitive
            ref={modelRef}
            object={clonedScene}
            scale={[1.6, 1.6, 1.6]}
            position={[0, 0, 0]}
            dispose={null}
        />
    );
}

useGLTF.preload('/strange_shapes/scene.gltf');

export default function VoronoiCube() {
    return (
        <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
            shadows={{ type: THREE.PCFShadowMap }}
        >
            <ambientLight intensity={0.4} color="#FFCB9A" />
            <pointLight position={[4, 4, 4]} intensity={30} color="#116466" castShadow />
            <pointLight position={[-4, -2, 2]} intensity={15} color="#D9B08C" />
            <pointLight position={[0, 6, -4]} intensity={10} color="#D1E8E2" />

            <Model />

            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate={false}
                dampingFactor={0.06}
                enableDamping
                rotateSpeed={0.8}
            />
        </Canvas>
    );
}
