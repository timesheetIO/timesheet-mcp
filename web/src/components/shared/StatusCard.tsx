/**
 * StatusCard - what a widget shows in place of its data: the tool call failed, or the host
 * cancelled it. Every widget uses it, so they all fail the same way.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolFailure } from '../../hooks';
import { classNames } from '../../utils/lib';
import Card from './Card';

interface StatusCardProps {
  status: ToolFailure;
  /** A more specific message than the default for the status */
  message?: string;
}

export default function StatusCard({ status, message }: StatusCardProps) {
  const { t } = useTranslation();
  const failed = status === 'error';

  return (
    <Card tone="plain" className="p-4">
      <p
        className={classNames('m-0 text-body-small', failed ? 'text-accent-danger' : 'text-secondary')}
        role={failed ? 'alert' : 'status'}
      >
        {message ?? (failed ? t('common.failed') : t('common.cancelled'))}
      </p>
    </Card>
  );
}
