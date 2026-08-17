/**
 * Inlined CSS for the dashboard. Uses @sthyra-crm/tokens.
 */

export const CSS = `
:root {
 --teal: #00B894;
 --amber: #F5A524;
 --bg: #f8f9fa;
 --fg: #212529;
 --muted: #6c757d;
 --border: #dee2e6;
}
* { box-sizing: border-box; }
body {
 font-family: system-ui, -apple-system, sans-serif;
 margin: 0;
 padding: 0;
 background: var(--bg);
 color: var(--fg);
}
.header {
 background: var(--teal);
 color: white;
 padding: 16px 24px;
 display: flex;
 justify-content: space-between;
 align-items: center;
}
.header h1 { margin: 0; font-size: 20px; }
.nav { display: flex; gap: 16px; }
.nav a { color: white; text-decoration: none; opacity: 0.9; }
.nav a:hover { opacity: 1; text-decoration: underline; }
.container { max-width: 1200px; margin: 24px auto; padding: 0 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.card {
 background: white;
 border: 1px solid var(--border);
 border-radius: 8px;
 padding: 16px;
}
.card h2 { margin: 0 0 8px 0; font-size: 16px; color: var(--muted); text-transform: uppercase; }
.card .value { font-size: 24px; font-weight: bold; }
.badge {
 display: inline-block;
 padding: 4px 8px;
 border-radius: 4px;
 font-size: 12px;
 font-weight: bold;
 background: var(--teal);
 color: white;
}
.badge.warning { background: var(--amber); }
.badge.error { background: #dc3545; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
th { background: var(--bg); font-size: 12px; color: var(--muted); text-transform: uppercase; }
tr:hover td { background: #f1f3f5; }
form { margin: 16px 0; }
input[type="text"] {
 width: 100%;
 padding: 8px;
 border: 1px solid var(--border);
 border-radius: 4px;
 font-size: 14px;
}
button {
 background: var(--teal);
 color: white;
 border: 0;
 padding: 8px 16px;
 border-radius: 4px;
 font-size: 14px;
 cursor: pointer;
}
button:hover { opacity: 0.9; }
a { color: var(--teal); text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted); font-size: 12px; }
.error { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin: 16px 0; }
.copy { background: #e7f5ff; border-left: 4px solid var(--teal); padding: 12px; margin: 16px 0; white-space: pre-wrap; }
@media (max-width: 768px) {
 .grid { grid-template-columns: 1fr; }
 .header { flex-direction: column; gap: 8px; }
}
`;
