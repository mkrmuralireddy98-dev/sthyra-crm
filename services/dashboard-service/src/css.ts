/**
 * Inlined CSS for the dashboard. Modern design system.
 * Color palette: teal primary, amber warning. Inter font.
 */

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
 /* Brand */
 --teal-50: #e8f8f3;
 --teal-100: #c5efe0;
 --teal-200: #9ae6cd;
 --teal-500: #00B894;
 --teal-600: #00a37f;
 --teal-700: #008a6a;
 --amber-50: #fef5e7;
 --amber-500: #F5A524;
 --amber-600: #d9951d;

 /* Neutrals */
 --gray-50: #f8f9fa;
 --gray-100: #f1f3f5;
 --gray-200: #e9ecef;
 --gray-300: #dee2e6;
 --gray-400: #ced4da;
 --gray-500: #adb5bd;
 --gray-600: #6c757d;
 --gray-700: #495057;
 --gray-800: #343a40;
 --gray-900: #212529;

 /* Semantic */
 --bg: var(--gray-50);
 --surface: #ffffff;
 --fg: var(--gray-900);
 --fg-muted: var(--gray-600);
 --border: var(--gray-200);
 --success: var(--teal-500);
 --warning: var(--amber-500);
 --danger: #dc3545;

 /* Spacing */
 --space-1: 4px;
 --space-2: 8px;
 --space-3: 12px;
 --space-4: 16px;
 --space-5: 24px;
 --space-6: 32px;
 --space-7: 48px;

 /* Radii */
 --radius-sm: 4px;
 --radius-md: 8px;
 --radius-lg: 12px;

 /* Shadows */
 --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
 --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
 --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
 font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
 background: var(--bg);
 color: var(--fg);
 font-size: 14px;
 line-height: 1.5;
 -webkit-font-smoothing: antialiased;
}

/* Header */
.header {
 background: var(--surface);
 border-bottom: 1px solid var(--border);
 padding: 0 var(--space-6);
 height: 60px;
 display: flex;
 align-items: center;
 justify-content: space-between;
 position: sticky;
 top: 0;
 z-index: 10;
 box-shadow: var(--shadow-sm);
}
.header-brand {
 display: flex;
 align-items: center;
 gap: var(--space-3);
 font-weight: 700;
 font-size: 17px;
 color: var(--gray-900);
 text-decoration: none;
}
.header-brand-mark {
 width: 28px;
 height: 28px;
 border-radius: var(--radius-sm);
 background: var(--teal-500);
 display: inline-flex;
 align-items: center;
 justify-content: center;
 color: white;
 font-weight: 800;
 font-size: 14px;
}
.nav { display: flex; gap: var(--space-2); }
.nav a {
 color: var(--gray-700);
 text-decoration: none;
 padding: 6px 12px;
 border-radius: var(--radius-sm);
 font-size: 13px;
 font-weight: 500;
 transition: all 0.15s;
}
.nav a:hover { background: var(--gray-100); color: var(--gray-900); }

/* Main layout */
.container {
 max-width: 1200px;
 margin: 0 auto;
 padding: var(--space-7) var(--space-6);
}
.page-header {
 display: flex;
 justify-content: space-between;
 align-items: flex-start;
 margin-bottom: var(--space-6);
}
.page-title {
 font-size: 24px;
 font-weight: 700;
 color: var(--gray-900);
 margin-bottom: var(--space-1);
}
.page-subtitle {
 color: var(--fg-muted);
 font-size: 14px;
}
.tenant-tag {
 display: inline-block;
 padding: 4px 10px;
 background: var(--teal-50);
 color: var(--teal-700);
 border-radius: 12px;
 font-size: 12px;
 font-weight: 500;
}

/* Stats grid */
.stats-grid {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
 gap: var(--space-4);
 margin-bottom: var(--space-6);
}
.stat-card {
 background: var(--surface);
 border: 1px solid var(--border);
 border-radius: var(--radius-md);
 padding: var(--space-5);
 transition: all 0.2s;
}
.stat-card:hover {
 border-color: var(--teal-500);
 box-shadow: var(--shadow-md);
 transform: translateY(-1px);
}
.stat-label {
 font-size: 12px;
 text-transform: uppercase;
 letter-spacing: 0.05em;
 color: var(--fg-muted);
 font-weight: 600;
 margin-bottom: var(--space-2);
}
.stat-value {
 font-size: 28px;
 font-weight: 700;
 color: var(--gray-900);
}
.stat-trend {
 font-size: 12px;
 color: var(--fg-muted);
 margin-top: var(--space-1);
}

/* Project cards */
.section {
 background: var(--surface);
 border: 1px solid var(--border);
 border-radius: var(--radius-md);
 padding: var(--space-5);
 margin-bottom: var(--space-4);
}
.section-title {
 font-size: 16px;
 font-weight: 600;
 color: var(--gray-900);
 margin-bottom: var(--space-4);
 display: flex;
 align-items: center;
 justify-content: space-between;
}
.project-grid {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
 gap: var(--space-4);
}
.project-card {
 background: var(--surface);
 border: 1px solid var(--border);
 border-radius: var(--radius-md);
 padding: var(--space-5);
 transition: all 0.2s;
 cursor: pointer;
 text-decoration: none;
 color: inherit;
 display: block;
}
.project-card:hover {
 border-color: var(--teal-500);
 box-shadow: var(--shadow-md);
 transform: translateY(-1px);
}
.project-name {
 font-size: 16px;
 font-weight: 600;
 color: var(--gray-900);
 margin-bottom: var(--space-2);
}
.project-meta {
 display: flex;
 gap: var(--space-3);
 color: var(--fg-muted);
 font-size: 12px;
 margin-bottom: var(--space-3);
}
.progress-bar {
 height: 6px;
 background: var(--gray-100);
 border-radius: 3px;
 overflow: hidden;
 margin-bottom: var(--space-2);
}
.progress-fill {
 height: 100%;
 background: var(--teal-500);
 transition: width 0.3s;
}

/* Tables */
.data-table {
 width: 100%;
 background: var(--surface);
 border: 1px solid var(--border);
 border-radius: var(--radius-md);
 overflow: hidden;
 border-collapse: collapse;
}
.data-table thead {
 background: var(--gray-50);
 border-bottom: 1px solid var(--border);
}
.data-table th {
 text-align: left;
 padding: 10px 16px;
 font-size: 11px;
 text-transform: uppercase;
 letter-spacing: 0.05em;
 color: var(--fg-muted);
 font-weight: 600;
}
.data-table td {
 padding: 12px 16px;
 border-top: 1px solid var(--border);
 font-size: 13px;
}
.data-table tr:first-child td { border-top: 0; }
.data-table tr:hover td { background: var(--gray-50); }
.data-table a {
 color: var(--teal-600);
 text-decoration: none;
 font-weight: 500;
}
.data-table a:hover { text-decoration: underline; }

/* Badges */
.badge {
 display: inline-block;
 padding: 2px 8px;
 border-radius: 12px;
 font-size: 11px;
 font-weight: 600;
 text-transform: uppercase;
 letter-spacing: 0.03em;
}
.badge-success { background: var(--teal-50); color: var(--teal-700); }
.badge-warning { background: var(--amber-50); color: var(--amber-600); }
.badge-danger { background: #f8d7da; color: #721c24; }
.badge-neutral { background: var(--gray-100); color: var(--gray-700); }
.badge-info { background: #d1ecf1; color: #0c5460; }
.badge-critical { background: #f8d7da; color: #721c24; }
.badge-high { background: var(--amber-50); color: var(--amber-600); }
.badge-medium { background: var(--gray-100); color: var(--gray-700); }
.badge-low { background: #d1ecf1; color: #0c5460; }

/* Empty state */
.empty {
 text-align: center;
 padding: var(--space-7) var(--space-5);
 color: var(--fg-muted);
}
.empty-title { font-size: 16px; font-weight: 600; color: var(--gray-700); margin-bottom: var(--space-2); }
.muted { color: var(--fg-muted); }

/* Error */
.error {
 background: #f8d7da;
 color: #721c24;
 border: 1px solid #f5c6cb;
 border-radius: var(--radius-md);
 padding: var(--space-4) var(--space-5);
 margin-bottom: var(--space-4);
}
.error strong { display: block; font-size: 16px; margin-bottom: var(--space-1); }

/* File upload (placeholder for Phase 2) */
.upload-zone {
 border: 2px dashed var(--gray-300);
 border-radius: var(--radius-md);
 padding: var(--space-7) var(--space-5);
 text-align: center;
 background: var(--gray-50);
 color: var(--fg-muted);
 transition: all 0.2s;
 cursor: pointer;
}
.upload-zone:hover {
 border-color: var(--teal-500);
 background: var(--teal-50);
 color: var(--teal-700);
}
.upload-icon { font-size: 32px; margin-bottom: var(--space-2); }

/* Layout helpers */
.row { display: flex; gap: var(--space-4); }
.col { flex: 1; }
.spacer { height: var(--space-4); }
.mt-2 { margin-top: var(--space-2); }
.mt-4 { margin-top: var(--space-4); }
.mt-4 { margin-top: var(--space-4); }

\`
`
;
