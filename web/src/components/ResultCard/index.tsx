/**
 * ResultCard Widget
 * One template for small result cards, picked by structuredContent.kind:
 * - export: export_send ("Timesheet sent to ..."), export_generate / export_from_template
 *   ("Export ready" with a download)
 * - absence: absence_create, _update, _approve, _reject, _cancel, _get
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, DocumentDownloadIcon, DocumentTextIcon, MailIcon } from '@heroicons/react/outline';
import { McpAppProvider } from '../../McpAppProvider';
import { useCallTool, useLocale, useOpenLink, useToolOutput, useUpdateModelContext } from '../../hooks';
import { formatDateRange, projectColor } from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import Badge, { type BadgeTone } from '../shared/Badge';
import ActionRow, { Button } from '../shared/ActionRow';
import Skeleton from '../shared/Skeleton';
import '../../i18n';
import '../../index.css';

interface ExportResult {
  kind: 'export';
  export: {
    status: 'ready' | 'sent';
    format: string;
    startDate?: string;
    endDate?: string;
    email?: string;
    downloadUrl?: string;
    filename?: string;
    reportName?: string;
  };
}

type AbsenceAction = 'requested' | 'updated' | 'approved' | 'rejected' | 'cancelled' | 'viewed';

interface AbsenceResult {
  kind: 'absence';
  action: AbsenceAction;
  absence: {
    id: string;
    typeName: string;
    typeColor?: string | number;
    startDate: string;
    endDate: string;
    totalDays?: number;
    halfDay?: boolean;
    status: string;
    note?: string;
    userName?: string;
    organizationId?: string;
    canCancel?: boolean;
  };
}

type Result = ExportResult | AbsenceResult;

/** "PDF", "Excel", "CSV" */
function formatLabel(format: string): string {
  const value = (format || '').toLowerCase();
  if (value.startsWith('xlsx')) return 'Excel';
  return value.toUpperCase();
}

function CardHeader({ icon, title, subtitle, aside }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <IconTile>{icon}</IconTile>
      <div className="flex-1 min-w-0">
        <h2 className="m-0 text-body font-semibold text-text-primary text-balance break-words">{title}</h2>
        {subtitle && <p className="m-0 mt-0.5 text-body-small text-secondary">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

function ExportCard({ result }: { result: ExportResult['export'] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const openLink = useOpenLink();
  const updateModelContext = useUpdateModelContext();

  const period = result.startDate ? formatDateRange(result.startDate, result.endDate, locale) : undefined;
  const details = [
    result.status === 'ready' ? result.filename : result.reportName,
    period,
    result.format ? formatLabel(result.format) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  if (result.status === 'sent') {
    return (
      <Card className="p-4 sm:p-5">
        <CardHeader
          icon={<MailIcon />}
          title={result.email ? t('resultCard.export.sentTo', { email: result.email }) : t('resultCard.export.sent')}
          subtitle={details || undefined}
        />
      </Card>
    );
  }

  const download = async () => {
    if (!result.downloadUrl) return;
    await openLink(result.downloadUrl);
    updateModelContext(`The user downloaded the export${result.filename ? ` ${result.filename}` : ''}.`);
  };

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        icon={<DocumentTextIcon />}
        title={t('resultCard.export.ready')}
        subtitle={details || undefined}
      />
      {result.downloadUrl && (
        <div className="mt-4 pl-0 min-[480px]:pl-[60px]">
          <Button variant="primary" icon={<DocumentDownloadIcon />} onClick={download}>
            {t('resultCard.export.download')}
          </Button>
        </div>
      )}
    </Card>
  );
}

function statusTone(status: string): { tone: BadgeTone; key: string } {
  const value = (status || '').toUpperCase();
  if (['PENDING', 'REQUESTED', 'OPEN'].includes(value)) return { tone: 'warning', key: 'pending' };
  if (['APPROVED', 'ACCEPTED'].includes(value)) return { tone: 'success', key: 'approved' };
  if (['REJECTED', 'DECLINED', 'DENIED'].includes(value)) return { tone: 'danger', key: 'rejected' };
  if (['CANCELLED', 'CANCELED'].includes(value)) return { tone: 'neutral', key: 'cancelled' };
  return { tone: 'neutral', key: '' };
}

/**
 * Whether the card offers "Cancel request". The API says whether this user may cancel the
 * absence; results without that flag only offer it right after the user's own request.
 */
function offersCancel({ absence, action }: AbsenceResult): boolean {
  if (!absence.organizationId || statusTone(absence.status).key !== 'pending') {
    return false;
  }
  return absence.canCancel ?? action === 'requested';
}

function AbsenceCard({ result: initial }: { result: AbsenceResult }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const callTool = useCallTool();
  const updateModelContext = useUpdateModelContext();
  const [result, setResult] = useState(initial);
  const [cancelMode, setCancelMode] = useState<'idle' | 'reason' | 'busy'>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A new result from the host replaces whatever the card showed
  useEffect(() => {
    setResult(initial);
    setCancelMode('idle');
  }, [initial]);

  const { absence, action } = result;
  const status = statusTone(absence.status);

  const confirmCancel = async () => {
    const text = reason.trim();
    if (!text) {
      setError(t('resultCard.absence.cancel.reasonRequired'));
      return;
    }
    setCancelMode('busy');
    setError(null);
    try {
      const response = await callTool('absence_cancel', {
        organizationId: absence.organizationId,
        id: absence.id,
        reason: text,
      });
      const next = response?.structuredContent as AbsenceResult | undefined;
      if (response?.isError || next?.kind !== 'absence' || !next.absence) {
        throw new Error('absence_cancel returned no absence');
      }
      setResult(next);
      setCancelMode('idle');
      setReason('');
      updateModelContext(
        `The user cancelled their ${absence.typeName} request for ${absence.startDate} to ${absence.endDate}. Reason: ${text}`
      );
    } catch (err) {
      console.error('[ResultCard] Cancelling the absence failed:', err);
      setCancelMode('reason');
      setError(t('resultCard.absence.cancel.failed'));
    }
  };
  const dot = projectColor(absence.typeColor as any);

  const range = formatDateRange(absence.startDate, absence.endDate !== absence.startDate ? absence.endDate : undefined, locale);
  const days = typeof absence.totalDays === 'number'
    ? t('resultCard.absence.days', { count: absence.totalDays })
    : undefined;
  const subtitle = [range, days, absence.halfDay ? t('resultCard.absence.halfDay') : undefined, absence.userName]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        icon={<CalendarIcon />}
        title={t(`resultCard.absence.title.${action || 'viewed'}`, { type: absence.typeName })}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            {dot && <i className="inline-block w-2 h-2 rounded-full flex-none" style={{ background: dot }} aria-hidden="true" />}
            <span>{subtitle}</span>
          </span>
        }
        aside={
          <Badge tone={status.tone}>
            {status.key ? t(`resultCard.absence.status.${status.key}`) : absence.status}
          </Badge>
        }
      />
      {absence.note && (
        <p className="m-0 mt-3 pl-0 min-[480px]:pl-[60px] text-body-small text-text-primary whitespace-pre-line break-words">
          {absence.note}
        </p>
      )}
      {offersCancel(result) && cancelMode === 'idle' && (
        <div className="mt-4 pl-0 min-[480px]:pl-[60px]">
          <Button onClick={() => setCancelMode('reason')}>{t('resultCard.absence.cancel.action')}</Button>
        </div>
      )}
      {offersCancel(result) && cancelMode !== 'idle' && (
        <div className="mt-4 pl-0 min-[480px]:pl-[60px] space-y-3">
          <label htmlFor="cancel-reason" className="block text-xs font-medium text-secondary">
            {t('resultCard.absence.cancel.reasonLabel')}
          </label>
          <textarea
            id="cancel-reason"
            rows={2}
            autoFocus
            value={reason}
            disabled={cancelMode === 'busy'}
            onChange={event => {
              setReason(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'cancel-error' : undefined}
            className="block w-full text-sm border border-border bg-background-primary text-text-primary rounded-xl resize-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/100"
          />
          {error && (
            <p id="cancel-error" role="alert" className="m-0 text-body-small text-accent-danger">
              {error}
            </p>
          )}
          <ActionRow>
            <Button
              disabled={cancelMode === 'busy'}
              onClick={() => {
                setCancelMode('idle');
                setError(null);
              }}
            >
              {t('common.back')}
            </Button>
            <Button variant="danger" disabled={cancelMode === 'busy'} onClick={confirmCancel}>
              {cancelMode === 'busy' ? t('common.working') : t('resultCard.absence.cancel.confirm')}
            </Button>
          </ActionRow>
        </div>
      )}
    </Card>
  );
}

function ResultCardApp() {
  const { t } = useTranslation();
  const result = useToolOutput<Result>();

  if (!result || !('kind' in result)) {
    return <Skeleton label={t('common.loading')} />;
  }
  if (result.kind === 'export' && result.export) {
    return <ExportCard result={result.export} />;
  }
  if (result.kind === 'absence' && result.absence) {
    return <AbsenceCard result={result} />;
  }
  return null;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <McpAppProvider appName="ResultCard">
      <ResultCardApp />
    </McpAppProvider>
  );
}
