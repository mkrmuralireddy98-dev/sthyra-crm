import type { Metadata } from 'next';
import { toCssVariables, type ColorMode } from '@sthyra-crm/tokens';
import { TopNav } from '@/components/top-nav';
import { CommandPalette } from '@/components/command-palette';
import { ToastViewport } from '@/components/toast';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import './globals.css';

export const metadata: Metadata = {
 title: 'sthyra — visual intelligence for the built world',
 description: 'continuous reality capture fused to BIM, with a copilot for the field.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
 const mode: ColorMode = 'dark';
 const css = toCssVariables(mode);
 return (
 <html lang="en" data-mode={mode}>
 <head>
 <meta name="theme-color" content="#050505" />
 <style id="sthyra-tokens" dangerouslySetInnerHTML={{ __html: css }} />
 </head>
 <body>
 {children}
 <CommandPalette />
 <ToastViewport />
 <KeyboardShortcuts />
 </body>
 </html>
 );
}
