import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/api';

// Resources fail independently. Generation guards keep slow reads from replacing confirmed writes.
export function useResource<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const result = await apiRequest<T>(path);
      if (request === generation.current) setData(result);
      return result;
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'Could not load this part of the room.');
      return undefined;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [path]);
  const confirm = useCallback((result: T) => {
    generation.current++; setData(result); setError(''); setLoading(false);
  }, []);
  useEffect(() => {
    void reload();
    const activeGeneration = generation;
    return () => { activeGeneration.current++; };
  }, [reload]);
  return { data, error, loading, reload, confirm };
}
