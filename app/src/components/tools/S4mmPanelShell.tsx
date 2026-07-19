'use client';

import type { ReactNode } from 'react';
import { Spinner, X } from '@phosphor-icons/react';

/**
 * Shared shell for the S4MM 2.0 tool panels: title bar with close button,
 * description, and a content region.
 */
export default function S4mmPanelShell({
  title,
  description,
  onClose,
  actions,
  loading = false,
  children,
}: {
  title: string;
  description: string;
  onClose?: () => void;
  actions?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[18px] border"
      style={{ backgroundColor: 'var(--ui-panel)', borderColor: 'var(--border-color)' }}
    >
      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Spinner size={20} className="animate-spin" color="var(--text-secondary)" />}
          {actions}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-2 transition-colors"
              style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-secondary)' }}
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function S4mmActionButton({
  onClick,
  disabled = false,
  children,
  tone = 'primary',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const styles =
    tone === 'primary'
      ? { backgroundColor: '#7cf262', color: '#111' }
      : tone === 'danger'
        ? { backgroundColor: 'rgba(255, 99, 99, 0.16)', color: '#ff8484' }
        : { backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      style={{ ...styles, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
}

export function S4mmEmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
      {message}
    </p>
  );
}
