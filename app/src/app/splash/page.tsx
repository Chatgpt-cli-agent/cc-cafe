'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

type SplashStage = 'checking' | 'loading' | 'starting' | 'error';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SplashPage() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<SplashStage>('checking');
  const [progress, setProgress] = useState(14);
  const [version, setVersion] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const openMainWindow = useCallback(async () => {
    await sleep(500);
    window.location.replace('/');
  }, []);

  const initializeSplash = useCallback(async () => {
    try {
      const appVersion = await window.electron.ipcRenderer.invoke('app:getVersion');
      setVersion(appVersion);

      await sleep(1400);
      setStage('loading');
      await sleep(2200);
      setStage('starting');
      setProgress(100);
      await openMainWindow();
    } catch (error) {
      console.error('Splash initialization error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setStage('starting');
      setProgress(100);
      await openMainWindow();
    }
  }, [openMainWindow]);

  useEffect(() => {
    void initializeSplash();
  }, [initializeSplash]);

  useEffect(() => {
    if (stage === 'starting') {
      setProgress(100);
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => {
        const ceiling = stage === 'checking' ? 34 : 92;
        const increment = stage === 'checking' ? 1.2 : 1.9;
        return Math.min(current + increment, ceiling);
      });
    }, 90);

    return () => window.clearInterval(interval);
  }, [stage]);

  const statusText =
    stage === 'checking'
      ? t('splash.checking_updates')
      : stage === 'loading'
        ? 'Brewing your CC collection...'
        : stage === 'error'
          ? t('splash.error_checking_updates')
          : t('splash.starting');

  return (
    <div
      className="relative flex h-screen w-screen select-none overflow-hidden"
      style={{
        backgroundColor: '#f4efdf',
        color: '#5d6a55',
        WebkitAppRegion: 'drag',
      } as CSSProperties}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(170, 166, 146, 0.18) 0 1px, transparent 1px), radial-gradient(circle at 80% 30%, rgba(170, 166, 146, 0.15) 0 1px, transparent 1px), radial-gradient(circle at 35% 70%, rgba(170, 166, 146, 0.16) 0 1px, transparent 1px), radial-gradient(circle at 65% 65%, rgba(170, 166, 146, 0.14) 0 1px, transparent 1px)',
          backgroundSize: '220px 220px',
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-24 bg-[#8a916c]/25" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-[#6d7553]" />

      <div className="absolute left-8 bottom-8 flex items-end gap-4">
        <div className="relative h-44 w-28">
          <div
            className="absolute bottom-0 left-0 h-36 w-24 rounded-t-[34px] rounded-b-[10px] border border-[#b3ab94] bg-[#f2e7d6]"
            style={{ boxShadow: '0 10px 20px rgba(78, 71, 54, 0.12)' }}
          />
          <div className="absolute left-5 top-3 h-28 w-16 rounded-full bg-[#7b8f57]" style={{ transform: 'rotate(-10deg)' }} />
          <div className="absolute left-10 top-0 h-24 w-14 rounded-full bg-[#91a665]" style={{ transform: 'rotate(18deg)' }} />
          <div className="absolute left-12 top-10 h-16 w-10 rounded-full bg-[#667e44]" style={{ transform: 'rotate(-30deg)' }} />
        </div>
        <div className="mb-2 h-28 w-8 rounded-sm bg-[#99a06f]" />
        <div className="mb-2 h-32 w-10 rounded-sm bg-[#afb28f]" />
        <div className="mb-2 h-34 w-12 rounded-sm bg-[#d0c6a5]" />
        <div className="absolute -bottom-2 left-6 h-10 w-10 rounded-full border border-[#8d8769] bg-[#f3efe3]" />
      </div>

      <div className="absolute right-10 bottom-10 flex items-end gap-3">
        <div className="mb-3 h-24 w-12 rounded-sm bg-[#cbc1a0]" />
        <div className="mb-1 h-28 w-14 rounded-sm bg-[#a9b086]" />
        <div className="mb-0 h-20 w-24 rounded-sm bg-[#d5ccb0]" />
        <div
          className="absolute right-4 bottom-8 h-24 w-28 rounded-md border border-[#cabd9d] bg-[#f7f0e1]"
          style={{ boxShadow: '0 10px 20px rgba(78, 71, 54, 0.10)' }}
        >
          <div className="absolute inset-3 flex items-center justify-center">
            <div className="h-12 w-12 rotate-45 rounded-md bg-[#9ec84f]" />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.2fr_1fr]">
          <div className="hidden lg:flex justify-center">
            <div className="space-y-3">
              <div className="h-3 w-40 rounded-full bg-[#d8ceb2]" />
              <div className="h-3 w-32 rounded-full bg-[#cbc19f]" />
              <div className="h-3 w-44 rounded-full bg-[#e0d7c1]" />
              <div className="h-36 w-14 rounded-sm bg-[#b9c18f]" style={{ transform: 'rotate(-6deg)' }} />
            </div>
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-3 self-start">
              <div className="w-7 h-7 text-[#5c8c43] flex-shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M12 2L3 11L12 22L21 11L12 2Z" />
                </svg>
              </div>
              <div className="flex items-end gap-1 font-black tracking-tight" aria-label="CC Café">
                <span className="text-[28px] leading-none text-[#5d6a55]">CC</span>
                <span className="text-[28px] leading-none text-[#5c8c43]">CAFÉ</span>
              </div>
            </div>

            <div className="relative mb-6 flex h-56 w-56 items-center justify-center">
              <div
                className="absolute inset-0 animate-pulse rounded-full"
                style={{ backgroundColor: 'rgba(131, 170, 64, 0.08)' }}
              />
              <div
                className="relative h-36 w-36 animate-[plumbobFloat_4.5s_ease-in-out_infinite] shadow-[0_20px_30px_rgba(90,118,52,0.18)]"
                style={{
                  clipPath: 'polygon(50% 0%, 92% 50%, 50% 100%, 8% 50%)',
                  background:
                    'linear-gradient(135deg, #d7f26a 0%, #97d34b 34%, #5cac4b 66%, #3a9244 100%)',
                }}
              >
                <div
                  className="absolute inset-x-[12%] top-0 h-1/2"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  }}
                />
                <div
                  className="absolute inset-x-[12%] bottom-0 h-1/2"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    backgroundColor: 'rgba(25, 82, 31, 0.12)',
                  }}
                />
              </div>

              <div className="absolute left-8 top-20 h-4 w-4 rotate-45 rounded-sm bg-[#c1d68b]" />
              <div className="absolute right-10 top-24 h-6 w-6 rotate-45 rounded-sm bg-[#cedd9c]" />
              <div className="absolute bottom-20 left-14 h-3 w-3 rotate-45 rounded-sm bg-[#a0c16a]" />
              <div className="absolute bottom-24 right-16 h-3 w-3 rotate-45 rounded-sm bg-[#d7e4a7]" />
            </div>

            <h1 className="text-[72px] font-black uppercase tracking-tight" style={{ lineHeight: 0.95 }}>
              CC Café
            </h1>
            <p className="mt-2 text-[22px] font-medium uppercase tracking-[0.28em]" style={{ color: '#6e7758' }}>
              Mod Manager
            </p>
            <p className="mt-4 text-[15px]" style={{ color: '#7f856d' }}>
              organize. update. enhance your game.
            </p>

            <div className="mt-10 w-full max-w-xl">
              <div
                className="h-9 rounded-full border bg-[#faf7ef] p-1"
                style={{ borderColor: '#d7ccb0', boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.08)' }}
              >
                <div
                  className="relative h-full overflow-hidden rounded-full transition-all duration-200"
                  style={{ width: `${progress}%`, backgroundColor: '#97c85b' }}
                >
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0 12px, transparent 12px 24px)',
                    }}
                  />
                </div>
              </div>
              <p className="mt-6 text-xl font-medium" style={{ color: '#7b8169' }}>
                {statusText}
              </p>
              {version && (
                <p className="mt-3 text-sm" style={{ color: '#9a927d' }}>
                  v{version}
                </p>
              )}
              {errorMessage && stage === 'starting' && (
                <p className="mt-2 text-xs" style={{ color: '#8d836f' }}>
                  {t('splash.offline_mode')}
                </p>
              )}
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <div className="space-y-3">
              <div className="ml-8 h-24 w-24 rounded-md border border-[#cabd9d] bg-[#f7f0e1]" />
              <div className="ml-2 h-10 w-36 rounded-sm bg-[#c8bc95]" />
              <div className="h-12 w-28 rounded-sm bg-[#aab684]" />
              <div className="ml-10 h-20 w-20 rounded-full border border-[#c8bc95] bg-[#f7f0e1]" />
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes plumbobFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
        `,
      }} />
    </div>
  );
}
