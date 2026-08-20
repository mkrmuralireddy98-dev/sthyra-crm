import type { Metadata } from 'next';
import { toCssVariables, type ColorMode } from '@sthyra-crm/tokens';
import { CommandPalette } from '@/components/command-palette';
import './globals.css';

export const metadata: Metadata = {
 title: 'Sthyra CRM — Visual Intelligence for the Built World',
 description: 'Continuous reality capture fused to BIM, with a Copilot for the field.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
 const mode: ColorMode = 'dark';
 const css = toCssVariables(mode);
 return (
 <html lang="en" data-mode={mode}>
 <head>
 <meta name="theme-color" content="#08090a" />
 <style id="sthyra-crm-tokens" dangerouslySetInnerHTML={{ __html: css }} />
 </head>
 <body>
 {children}
 <CommandPalette />
 </body>
 </html>
 );
}
