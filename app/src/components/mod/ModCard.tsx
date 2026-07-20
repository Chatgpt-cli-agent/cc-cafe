/**
 * Mod Card Component for Grid View
 *
 * S4MM-style dense tile: square thumbnail, title, author, installed badge.
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, DownloadSimple, Spinner } from '@phosphor-icons/react';
import { CurseForgeMod } from '@/types/curseforge';
import { useToast } from '@/context/ToastContext';
import { useProfiles } from '@/context/ProfileContext';
import { modInstallationService } from '@/lib/services/ModInstallationService';
import { userPreferencesService } from '@/lib/services/UserPreferencesService';
import { getCompatStorageItem } from '@/lib/utils/storageCompat';
import { fakeScoreService } from '@/lib/services/FakeScoreService';
import { submitFakeModReport } from '@/lib/fakeDetectionApi';
import WarningBadge from './WarningBadge';
import FakeModWarningPopup from './FakeModWarningPopup';
import { useTranslation } from 'react-i18next';
import type { ModWarningStatus, FakeScoreResult, ZipAnalysis } from '@/types/fakeDetection';

interface ModCardProps {
  mod: CurseForgeMod;
  /** Warning status for this mod (optional, fetched from backend) */
  warningStatus?: ModWarningStatus;
}

/**
 * Dense S4MM-style grid tile.
 * Primary click opens the mod detail; install is available via the hover action.
 */
export default function ModCard({ mod, warningStatus }: ModCardProps) {
  const { t } = useTranslation();
  const { showToast, updateToast } = useToast();
  const { refreshProfiles, activeProfile } = useProfiles();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showFakeWarning, setShowFakeWarning] = useState(false);
  const [fakeScoreResult, setFakeScoreResult] = useState<FakeScoreResult | null>(null);
  const [pendingInstallResolve, setPendingInstallResolve] = useState<((decision: 'install' | 'cancel' | 'report') => void) | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isInstalled = activeProfile?.mods.some((m) => m.modId === mod.id) ?? false;
  const primaryAuthor = mod.authors[0];

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalling || isInstalled || warningStatus?.creatorBanned) return;

    try {
      setIsInstalling(true);

      const StorageHelper = {
        decryptData: async (encryptedData: string, password: string = 'cccafe-settings'): Promise<string | null> => {
          try {
            const encoder = new TextEncoder();
            const password_encoded = encoder.encode(password);
            const hash_buffer = await crypto.subtle.digest('SHA-256', password_encoded);
            const key = await crypto.subtle.importKey('raw', hash_buffer, 'AES-GCM', false, ['decrypt']);
            const binaryString = atob(encryptedData);
            const combined = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              combined[i] = binaryString.charCodeAt(i);
            }
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
            return new TextDecoder().decode(decrypted);
          } catch (error) {
            console.error('Decryption failed:', error);
            return null;
          }
        },
      };

      const encryptedModsPath = getCompatStorageItem('cccafe_mods_path');
      if (!encryptedModsPath) {
        showToast({
          type: 'error',
          title: t('mods.toasts.mods_path_not_configured'),
          message: t('mods.toasts.configure_in_settings'),
          duration: 3000,
        });
        return;
      }

      const modsPath = await StorageHelper.decryptData(encryptedModsPath);
      if (!modsPath) {
        showToast({
          type: 'error',
          title: t('mods.toasts.failed_to_read_path'),
          message: t('mods.toasts.reconfigure_in_settings'),
          duration: 3000,
        });
        return;
      }

      const toastId = showToast({
        type: 'download',
        title: t('mods.toasts.installing', { modName: mod.name }),
        message: t('mods.toasts.starting_download'),
        progress: 0,
        duration: 0,
      });

      const onFakeDetection = userPreferencesService.getFakeModDetection()
        ? async (scoreResult: FakeScoreResult, _zipAnalysis: ZipAnalysis): Promise<'install' | 'cancel' | 'report'> => {
            return new Promise((resolve) => {
              setFakeScoreResult(scoreResult);
              setPendingInstallResolve(() => resolve);
              setShowFakeWarning(true);
            });
          }
        : undefined;

      const result = await modInstallationService.installMod(
        mod.id,
        modsPath,
        (progress) => {
          updateToast(toastId, {
            title: `Installing ${mod.name}`,
            message: progress.message,
            progress: progress.percent,
          });
        },
        undefined,
        onFakeDetection
      );

      if (result.success) {
        updateToast(toastId, {
          type: 'success',
          title: t('mods.toasts.installation_complete'),
          message: t('mods.toasts.installed_successfully', { modName: result.modName }),
          duration: 3000,
        });
        await refreshProfiles();
      } else {
        updateToast(toastId, {
          type: 'error',
          title: t('mods.toasts.installation_failed'),
          message: result.error || t('mods.toasts.unknown_error'),
          duration: 3000,
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: t('mods.toasts.installation_failed'),
        message: error.message || t('mods.toasts.unexpected_error'),
        duration: 3000,
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInstallAnyway = () => {
    setShowFakeWarning(false);
    pendingInstallResolve?.('install');
    setPendingInstallResolve(null);
    setFakeScoreResult(null);
  };

  const handleReportAndCancel = async (reason: string) => {
    setIsSubmittingReport(true);
    try {
      const machineId = await fakeScoreService.getMachineId();
      await submitFakeModReport(mod.id, {
        machineId,
        reason,
        fakeScore: fakeScoreResult?.score || 0,
        creatorId: mod.authors[0]?.id,
        creatorName: mod.authors[0]?.name,
      });
      showToast({
        type: 'success',
        title: t('mods.report.submitted_title'),
        message: t('mods.report.submitted_message', { modName: mod.name }),
        duration: 3000,
      });
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast({
          type: 'info',
          title: t('mods.report.already_reported_title'),
          message: t('mods.report.already_reported_message'),
          duration: 3000,
        });
      } else {
        showToast({
          type: 'error',
          title: t('mods.report.failed_title'),
          message: t('mods.report.failed_message'),
          duration: 3000,
        });
      }
    } finally {
      setIsSubmittingReport(false);
      setShowFakeWarning(false);
      pendingInstallResolve?.('report');
      setPendingInstallResolve(null);
      setFakeScoreResult(null);
    }
  };

  const handleClosePopup = () => {
    setShowFakeWarning(false);
    pendingInstallResolve?.('cancel');
    setPendingInstallResolve(null);
    setFakeScoreResult(null);
  };

  const openCreator = (e: React.MouseEvent, author: { id: number; name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    window.history.pushState(
      null,
      '',
      `/?tab=creators&creatorId=${author.id}&creatorName=${encodeURIComponent(author.name)}`
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      <Link href={`/mods?id=${mod.id}`} className="group block min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-sm bg-neutral-900">
          {mod.logo ? (
            <Image
              src={mod.logo}
              alt={mod.name}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl" style={{ color: 'var(--text-tertiary)' }}>
              ?
            </div>
          )}

          {isInstalled && (
            <div
              className="absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-black shadow"
              title={t('mods.card.already_installed')}
            >
              <Check size={12} weight="bold" />
            </div>
          )}

          {warningStatus && (warningStatus.hasWarning || warningStatus.creatorBanned) && (
            <div className="absolute right-1.5 top-1.5 z-10">
              <WarningBadge status={warningStatus} size="sm" />
            </div>
          )}

          {!isInstalled && !warningStatus?.creatorBanned && (
            <button
              type="button"
              onClick={handleInstall}
              disabled={isInstalling}
              className="absolute bottom-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-black opacity-0 shadow transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed cursor-pointer"
              title={isInstalling ? t('mods.card.installing') : t('mods.card.install')}
            >
              {isInstalling ? <Spinner size={14} className="animate-spin" /> : <DownloadSimple size={14} weight="bold" />}
            </button>
          )}
        </div>

        <div className="mt-1.5 min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-tight text-white" title={mod.name}>
            {mod.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-neutral-400">
            {t('mods.card.by')}{' '}
            {primaryAuthor ? (
              <button
                type="button"
                onClick={(e) => openCreator(e, primaryAuthor)}
                className="underline hover:text-brand-green cursor-pointer"
              >
                {primaryAuthor.name}
              </button>
            ) : (
              t('mods.card.unknown_author')
            )}
          </p>
        </div>
      </Link>

      {fakeScoreResult && (
        <FakeModWarningPopup
          isOpen={showFakeWarning}
          onClose={handleClosePopup}
          onInstallAnyway={handleInstallAnyway}
          onReportAndCancel={handleReportAndCancel}
          modName={mod.name}
          scoreResult={fakeScoreResult}
          isSubmitting={isSubmittingReport}
        />
      )}
    </>
  );
}
