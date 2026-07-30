'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorBox({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="mb-3 flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-semibold">Bir hata oluştu</h2>
        </div>
        <p className="mb-1 text-sm text-muted-foreground">Sayfa yüklenirken aşağıdaki hata alındı:</p>
        <pre className="mb-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground">
          {error.message || 'Bilinmeyen hata'}
          {error.digest ? `\n\n(Referans: ${error.digest})` : ''}
        </pre>
        <div className="flex gap-2">
          <Button onClick={reset} variant="outline" size="sm">
            <RotateCcw className="mr-1.5 h-4 w-4" /> Tekrar dene
          </Button>
          <Button onClick={() => window.location.reload()} size="sm">Sayfayı yenile</Button>
        </div>
      </div>
    </div>
  );
}
