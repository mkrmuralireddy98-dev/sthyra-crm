'use client';

import { useEffect, useRef } from 'react';

interface Props {
 imageUrl: string;
 hotspots?: { yaw: number; pitch: number; text: string }[];
}

export function PanoramaViewer({ imageUrl, hotspots = [] }: Props) {
 const ref = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (!ref.current) return;

 // Inject Pannellum CSS + JS
 const link = document.createElement('link');
 link.rel = 'stylesheet';
 link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
 document.head.appendChild(link);

 const script = document.createElement('script');
 script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
 script.async = true;
 script.onload = () => {
 const w = window as any;
 if (w.pannellum && ref.current) {
 w.pannellum.viewer(ref.current, {
 type: 'equirectangular',
 panorama: imageUrl,
 autoLoad: true,
 autoRotate: -2,
 compass: false,
 showZoomCtrl: true,
 showFullscreenCtrl: true,
 hotspots: hotspots.map((h, i) => ({
 id: 'h' + i,
 yaw: h.yaw,
 pitch: h.pitch,
 text: h.text,
 type: 'info',
 })),
 });
 }
 };
 document.head.appendChild(script);

 return () => {
 link.remove();
 script.remove();
 };
 }, [imageUrl, hotspots]);

 return (
 <div
 ref={ref}
 style={{
 width: '100%',
 height: '100%',
 minHeight: 480,
 borderRadius: 'var(--radius-lg)',
 overflow: 'hidden',
 background: 'var(--bg-panel)',
 }}
 />
 );
}
