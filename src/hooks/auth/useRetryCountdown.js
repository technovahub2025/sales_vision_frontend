import { useEffect, useState } from 'react';

export function useRetryCountdown(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds || 0);
  }, [initialSeconds]);

  useEffect(() => {
    if (!secondsLeft || secondsLeft <= 0) {
      return undefined;
    }

    const handle = setInterval(() => {
      setSecondsLeft((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(handle);
  }, [secondsLeft]);

  return secondsLeft;
}
