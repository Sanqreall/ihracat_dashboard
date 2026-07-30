import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'İhracat ERP',
  description: 'İhracat operasyonları — sipariş, ödeme ve nakit akışı yönetimi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('yonga-theme');var c=localStorage.getItem('yonga-color-theme')||'walnut';var dark=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;if(dark)r.classList.add('dark');r.setAttribute('data-theme',c);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
