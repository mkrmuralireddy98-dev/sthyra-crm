'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveProject, ApiError } from '@/lib/api';

interface Props {
  projectId: string;
}

export function ArchiveButton({ projectId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onArchive() {
    setError(null);
    startTransition(async () => {
      try {
        await archiveProject(projectId);
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? `${err.title}: ${err.detail}` : String(err));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="plumb-button plumb-button--ghost"
        onClick={onArchive}
        disabled={isPending}
        aria-label="Archive project"
      >
        {isPending ? 'Archiving…' : 'Archive'}
      </button>
      {error && (
        <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-critical)' }}>
          {error}
        </span>
      )}
    </>
  );
}
