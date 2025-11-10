import React from 'react';

export const useGameLoop = (callback: () => void, delay: number) => {
  // FIX: `useRef` with a generic type argument requires an initial value.
  // Initializing it with the `callback` argument resolves the error.
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};