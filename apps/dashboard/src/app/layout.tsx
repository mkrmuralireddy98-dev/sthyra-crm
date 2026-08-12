import type { Metadata } from 'next';
import { toCssVariables, type ColorMode } from '@sthyra-crm/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sthyra CRM — Visual Intelligence for the Built World',
  description: 'Continuous reality capture fused to BIM, with a Copilot for the field.',
};

// Default to dark — the product default per master plan §4.
// Phase 1: read from cookies/header to support per-user preference + sunlight mode.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode: ColorMode = 'dark';
  const css = toCssVariables(mode);
  return (
    <html lang="en" data-mode={mode}>
      <head>
        <style id="sthyra-crm-tokens" dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
