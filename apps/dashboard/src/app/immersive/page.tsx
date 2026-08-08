import Link from 'next/link';

/**
 * Marketing-style /immersive placeholder. The full /immersive page (per the
 * master plan §3.1) is a working 360 viewer with a cinematic 14-second camera
 * path, layered BIM reveal, time scrub through 6 months of captures, and an
 * inspector mode side panel. That belongs in Phase 1 when the 3D viewer is
 * built. This page is the marketing shell that points to it.
 */
export default function ImmersivePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-fg)',
        padding: 'var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 720, textAlign: 'center' }}>
        <span
          className="plumb-badge"
          style={{ marginBottom: 'var(--space-4)', display: 'inline-block' }}
        >
          Coming with the 360 viewer · Phase 1
        </span>
        <h1 style={{ fontSize: 'var(--text-4xl)', margin: 'var(--space-4) 0', letterSpacing: 'var(--tracking-tight)' }}>
          Step inside.
        </h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-fg-muted)', margin: 0 }}>
          A full-bleed 360° walkthrough, with BIM overlays, time scrub across 6 months of weekly captures,
          and inspector mode that surfaces drift, trade attribution, and ETAs — straight from the product.
        </p>
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
          <Link href="/" className="plumb-button plumb-button--ghost">
            ← Back
          </Link>
          <a href="mailto:hello@plumb.dev" className="plumb-button">
            Book a walkthrough
          </a>
        </div>

        <div
          className="plumb-card"
          style={{ marginTop: 'var(--space-12)', textAlign: 'left', display: 'grid', gap: 'var(--space-3)' }}
        >
          <strong>What ships here in Phase 1:</strong>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', color: 'var(--color-fg-muted)' }}>
            <li>WebGL viewer with equirectangular + cube-map projections</li>
            <li>Cinematic 14-second camera path on a curated walkthrough</li>
            <li>Layered BIM reveal (cyan wireframe overlay at 60% opacity)</li>
            <li>Time scrub through 6 months of weekly captures</li>
            <li>Inspector mode with photo evidence, BIM diff, trade, ETA</li>
            <li>WebGL2 fallback to static panorama for low-end devices</li>
            <li>prefers-reduced-motion fallback (timeline scrub only)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
