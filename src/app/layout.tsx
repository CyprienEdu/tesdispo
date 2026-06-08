import type { Metadata } from 'next';

import './globals.css';
import { AuthProvider } from '@/components/auth-context';
import { Chrome } from '@/components/chrome';

export const metadata: Metadata = {
  title: 'TesDispo | Sorties et vacances entre amis',
  description: 'Organisez des sorties, week-ends et vacances en voyant les indisponibilites du jour, de la semaine et du mois.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider>
          <Chrome>{children}</Chrome>
        </AuthProvider>
      </body>
    </html>
  );
}
