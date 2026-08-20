'use client';

import { useEffect, useRef } from 'react';

interface Props {
 modelUrl?: string;
}

export function BimViewer({ modelUrl }: Props) {
 const ref = useRef<HTMLCanvasElement>(null);

 useEffect(() => {
 if (!ref.current) return;

 const script = document.createElement('script');
 script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
 script.async = true;
 script.onload = () => {
 if (!ref.current) return;
 const w = window as any;
 if (!w.THREE) return;

 const THREE = w.THREE;
 const canvas = ref.current;
 const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
 renderer.setSize(canvas.clientWidth, canvas.clientHeight);
 renderer.setPixelRatio(window.devicePixelRatio);
 renderer.setClearColor(0x08090a, 1);

 const scene = new THREE.Scene();
 scene.fog = new THREE.Fog(0x08090a, 50, 200);

 const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
 camera.position.set(20, 20, 20);
 camera.lookAt(0, 0, 0);

 // Lighting
 const ambient = new THREE.AmbientLight(0xffffff, 0.4);
 scene.add(ambient);
 const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
 dir1.position.set(30, 30, 30);
 scene.add(dir1);
 const dir2 = new THREE.DirectionalLight(0x4fddb6, 0.4);
 dir2.position.set(-30, 30, -30);
 scene.add(dir2);

 // Build a "BIM-like" model: stacked floors with walls
 const buildingGroup = new THREE.Group();
 const tealMat = new THREE.MeshStandardMaterial({ color: 0x00B894, metalness: 0.3, roughness: 0.6, transparent: true, opacity: 0.85 });
 const darkMat = new THREE.MeshStandardMaterial({ color: 0x191a1b, metalness: 0.6, roughness: 0.4 });
 const gridMat = new THREE.LineBasicMaterial({ color: 0x00B894, transparent: true, opacity: 0.3 });

 // Ground plane
 const groundGeo = new THREE.PlaneGeometry(80, 80);
 const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f1011, metalness: 0.1, roughness: 0.9 });
 const ground = new THREE.Mesh(groundGeo, groundMat);
 ground.rotation.x = -Math.PI / 2;
 ground.position.y = -0.01;
 scene.add(ground);

 // Floor grid
 const gridSize = 80;
 const gridDivisions = 40;
 const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00B894, 0x1f242c);
 gridHelper.position.y = 0;
 scene.add(gridHelper);

 // 3 stacked floors with walls (a tower)
 for (let f = 0; f < 3; f++) {
 const floorY = f * 4 + 2;
 const floorSize = 12 - f * 1.5;

 // Floor slab
 const slabGeo = new THREE.BoxGeometry(floorSize, 0.2, floorSize);
 const slab = new THREE.Mesh(slabGeo, tealMat);
 slab.position.y = floorY - 0.1;
 buildingGroup.add(slab);

 // Columns at corners
 for (let cx = -1; cx <= 1; cx += 2) {
 for (let cz = -1; cz <= 1; cz += 2) {
 const colGeo = new THREE.BoxGeometry(0.5, 4, 0.5);
 const col = new THREE.Mesh(colGeo, darkMat);
 col.position.set(cx * (floorSize / 2), floorY - 2 + 2, cz * (floorSize / 2));
 buildingGroup.add(col);
 }
 }

 // Walls (4 sides)
 const wallHeight = 4;
 const wallThickness = 0.2;
 // Front/back
 for (let side of [-1, 1]) {
 const wallGeo = new THREE.BoxGeometry(floorSize, wallHeight, wallThickness);
 const wall = new THREE.Mesh(wallGeo, darkMat);
 wall.position.set(0, floorY - 2 + wallHeight / 2, side * (floorSize / 2));
 buildingGroup.add(wall);
 }
 // Left/right
 for (let side of [-1, 1]) {
 const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, floorSize);
 const wall = new THREE.Mesh(wallGeo, darkMat);
 wall.position.set(side * (floorSize / 2), floorY - 2 + wallHeight / 2, 0);
 buildingGroup.add(wall);
 }
 }

 scene.add(buildingGroup);

 // OrbitControls-like (manual since we don't import OrbitControls)
 let isDragging = false;
 let prevX = 0;
 let prevY = 0;
 let camTheta = Math.PI / 4;
 let camPhi = Math.PI / 4;
 let camDist = 35;

 const updateCamera = () => camera.position.setFromSphericalCoords(camDist, camPhi, camTheta);
 updateCamera();

 const onMouseDown = (e: MouseEvent) => {
 isDragging = true;
 prevX = e.clientX;
 prevY = e.clientY;
 };
 const onMouseUp = () => { isDragging = false; };
 const onMouseMove = (e: MouseEvent) => {
 if (!isDragging) return;
 const dx = e.clientX - prevX;
 const dy = e.clientY - prevY;
 camTheta -= dx * 0.01;
 camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi - dy * 0.01));
 prevX = e.clientX;
 prevY = e.clientY;
 updateCamera();
 };
 const onWheel = (e: WheelEvent) => {
 e.preventDefault();
 camDist = Math.max(10, Math.min(80, camDist + e.deltaY * 0.05));
 updateCamera();
 };

 canvas.addEventListener('mousedown', onMouseDown);
 window.addEventListener('mouseup', onMouseUp);
 window.addEventListener('mousemove', onMouseMove);
 canvas.addEventListener('wheel', onWheel, { passive: false });

 let rafId: number;
 const animate = () => {
 renderer.render(scene, camera);
 rafId = requestAnimationFrame(animate);
 };
 animate();

 return () => {
 cancelAnimationFrame(rafId);
 canvas.removeEventListener('mousedown', onMouseDown);
 window.removeEventListener('mouseup', onMouseUp);
 window.removeEventListener('mousemove', onMouseMove);
 canvas.removeEventListener('wheel', onWheel);
 renderer.dispose();
 };
 };
 document.head.appendChild(script);

 return () => {
 script.remove();
 };
 }, [modelUrl]);

 return (
 <canvas
 ref={ref}
 style={{
 width: '100%',
 height: '100%',
 minHeight: 480,
 borderRadius: 'var(--radius-lg)',
 background: 'var(--bg-panel)',
 cursor: 'grab',
 }}
 />
 );
}
