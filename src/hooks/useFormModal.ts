import { useState } from 'react';
import { ApiError } from '../api/client';

function parseApiError(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.message);
      return body.error ?? body.detail ?? err.message;
    } catch {
      return err.message;
    }
  }
  return 'Błąd połączenia.';
}

export function useFormModal() {
  const [error,     setError]     = useState('');
  const [isPending, setIsPending] = useState(false);

  async function submit(action: () => Promise<void>) {
    setError('');
    setIsPending(true);
    try {
      await action();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsPending(false);
    }
  }

  return { error, isPending, submit, setError };
}
