import React, { useState, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';

export const RouteLoadingBar: React.FC = () => {
  const routerState = useRouterState();
  const isLoading = routerState.status === 'pending';

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;
    let timerComplete: NodeJS.Timeout;

    if (isLoading) {
      setVisible(true);
      setProgress(20);

      timer1 = setTimeout(() => {
        setProgress(45);
      }, 100);

      timer2 = setTimeout(() => {
        setProgress(70);
      }, 300);

      timer3 = setTimeout(() => {
        setProgress(85);
      }, 600);
    } else if (visible) {
      setProgress(100);
      timerComplete = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerComplete);
    };
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-slate-200/40 pointer-events-none overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 transition-all ease-out shadow-[0_0_12px_rgba(13,148,136,0.8)]"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '150ms' : progress === 20 ? '50ms' : '300ms',
        }}
      />
    </div>
  );
};
