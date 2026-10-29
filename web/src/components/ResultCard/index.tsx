/**
 * ResultCard Widget
 * One template for small result cards, picked by structuredContent.kind:
 * - export: export_send ("Timesheet sent to ..."), export_generate / export_from_template
 *   ("Export ready" with a download)
 * - absence: absence_create, _update, _approve, _reject, _cancel, _get
 * - record: every other write tool, confirming what it did ("Tag created", "Contract suspended")
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import {
  AnnotationIcon,
  CalendarIcon,
  CashIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CogIcon,
  DocumentDownloadIcon,
  DocumentTextIcon,
  FolderAddIcon,
  FolderIcon,
  MailIcon,
  OfficeBuildingIcon,
  PauseIcon,
  ReceiptRefundIcon,
  ScaleIcon,
  TagIcon,
  TemplateIcon,
  TrashIcon,
  UserAddIcon,
  UserCircleIcon,
  UserIcon,
  UserRemoveIcon,
} from '@heroicons/react/outline';
import { McpAppProvider } from '../../McpAppProvider';
import {
  useCallTool,
  useCanCallServerTools,
  useLocale,
  useOpenLink,
  useToolFailure,
  useTimeZone,
  useToolOutput,
  useUpdateModelContext,
} from '../../hooks';
import { formatDate, formatDateRange, formatDuration, formatNumber, projectColor } from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import Badge, { type BadgeTone } from '../shared/Badge';
import ActionRow, { Button } from '../shared/ActionRow';
import Skeleton from '../shared/Skeleton';
import StatusCard from '../shared/StatusCard';
import LinkFallback from '../shared/LinkFallback';
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
    /** Absent when the type is unknown */
    typeName?: string;
    typeColor?: string | number;
    startDate: string;
    endDate: string;
    totalDays?: number;
    /** false for an absence of part of a day, shown in hours */
    fullDay?: boolean;
    totalHours?: number;
    status: string;
    note?: string;
    userName?: string;
    organizationId?: string;
    canCancel?: boolean;
  };
}

type RecordAction =
  | 'created' | 'added' | 'updated' | 'deleted' | 'removed' | 'invited'
  | 'completed' | 'reopened' | 'activated' | 'suspended' | 'reactivated' | 'terminated'
  | 'refunded' | 'unrefunded';

interface RecordResult {
  kind: 'record';
  action: RecordAction;
  record: {
    type: string;
    name?: string;
    context?: string[];
    color?: string;
    amount?: number;
    durationSeconds?: number;
    date?: string;
    billable?: boolean;
    text?: string;
    changes?: Array<{ key: string; value: string }>;
  };
}

type Result = ExportResult | AbsenceResult | RecordResult;

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
  const [refused, setRefused] = useState(false);

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
    const opened = await openLink(result.downloadUrl);
    setRefused(!opened);
    // A refused link downloaded nothing: the model only hears of a download that started
    if (opened) {
      updateModelContext(`The user downloaded the export${result.filename ? ` ${result.filename}` : ''}.`);
    }
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
          {refused && (
            <div className="mt-3">
              <LinkFallback url={result.downloadUrl} />
            </div>
          )}
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
  const canCallTools = useCanCallServerTools();
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
  // The server leaves the type name out when it does not know the type
  const typeName = absence.typeName || t('resultCard.absence.defaultType');
  // Cancelling calls a server tool: a host that cannot proxy tool calls gets no button
  const cancellable = canCallTools && offersCancel(result);

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
        `The user cancelled their ${absence.typeName || 'absence'} request for ${absence.startDate} to ${absence.endDate}. Reason: ${text}`
      );
    } catch (err) {
      console.error('[ResultCard] Cancelling the absence failed:', err);
      setCancelMode('reason');
      setError(t('resultCard.absence.cancel.failed'));
    }
  };
  const dot = projectColor(absence.typeColor as any);

  const range = formatDateRange(absence.startDate, absence.endDate !== absence.startDate ? absence.endDate : undefined, locale);
  // Part of a day reads in hours ("4 h"), whole days in days ("1,5 Tage")
  const length = absence.fullDay === false && typeof absence.totalHours === 'number'
    ? t('resultCard.absence.hours', { value: formatNumber(absence.totalHours, locale, { maximumFractionDigits: 2 }) })
    : typeof absence.totalDays === 'number'
      ? t('resultCard.absence.days', {
        count: absence.totalDays,
        value: formatNumber(absence.totalDays, locale, { maximumFractionDigits: 2 }),
      })
      : undefined;
  const subtitle = [range, length, absence.userName]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        icon={<CalendarIcon />}
        title={t(`resultCard.absence.title.${action || 'viewed'}`, { type: typeName })}
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
      {cancellable && cancelMode === 'idle' && (
        <div className="mt-4 pl-0 min-[480px]:pl-[60px]">
          <Button onClick={() => setCancelMode('reason')}>{t('resultCard.absence.cancel.action')}</Button>
        </div>
      )}
      {cancellable && cancelMode !== 'idle' && (
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

/** Status changes carry a badge in the card's corner; plain creates and updates do not. */
const RECORD_BADGES: Partial<Record<RecordAction, BadgeTone>> = {
  deleted: 'danger',
  removed: 'danger',
  invited: 'neutral',
  completed: 'success',
  reopened: 'neutral',
  activated: 'success',
  suspended: 'warning',
  reactivated: 'success',
  terminated: 'neutral',
  refunded: 'success',
  unrefunded: 'neutral',
};

/** Setting values the card translates; anything else (a time zone, a format) shows as it is. */
const TRANSLATED_VALUES = new Set(['light', 'dark', 'system', 'true', 'false']);

const MEMBER_TYPES = new Set(['organizationMember', 'teamMember', 'projectMember']);

function recordIcon(type: string, action: RecordAction) {
  if (MEMBER_TYPES.has(type)) {
    if (action === 'removed') return <UserRemoveIcon />;
    return action === 'updated' ? <UserIcon /> : <UserAddIcon />;
  }
  if (action === 'deleted' || action === 'removed') return <TrashIcon />;
  switch (type) {
    case 'project': return action === 'created' ? <FolderAddIcon /> : <FolderIcon />;
    case 'task': return <ClockIcon />;
    case 'note': return <AnnotationIcon />;
    case 'expense': return action === 'refunded' || action === 'unrefunded' ? <ReceiptRefundIcon /> : <CashIcon />;
    case 'pause': return <PauseIcon />;
    case 'exportTemplate': return <TemplateIcon />;
    case 'absence':
    case 'absenceType': return <CalendarIcon />;
    case 'contract': return <DocumentTextIcon />;
    case 'organization': return <OfficeBuildingIcon />;
    case 'todo': return <CheckCircleIcon />;
    case 'rate': return <ScaleIcon />;
    case 'tag': return <TagIcon />;
    case 'profile': return <UserCircleIcon />;
    case 'settings': return <CogIcon />;
    default: return <CheckIcon />;
  }
}

/** Confirms a write: what happened as the title, the record and what it belongs to below. */
function RecordCard({ result }: { result: RecordResult }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const timeZone = useTimeZone();
  const { action, record } = result;

  const title = t(`resultCard.record.title.${record.type}.${action}`, {
    defaultValue: t(`resultCard.record.fallback.${action}`, { defaultValue: '' }),
  });
  const tone = RECORD_BADGES[action];
  const dot = projectColor(record.color);
  const subtitle = [record.name, ...(record.context ?? [])].filter(Boolean).join(' · ');
  const amount = typeof record.amount === 'number' && Number.isFinite(record.amount)
    ? formatNumber(record.amount, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : undefined;
  const duration = typeof record.durationSeconds === 'number' ? formatDuration(record.durationSeconds, locale) : undefined;
  // The corner holds a status change's badge, else the amount or the duration
  const figure = amount ?? duration;
  const aside = tone ? (
    <Badge tone={tone}>{t(`resultCard.record.badge.${action}`)}</Badge>
  ) : figure ? (
    <span className="font-mono tabular-nums text-[22px] sm:text-[24px] leading-none pt-1 text-accent-text whitespace-nowrap">
      {figure}
    </span>
  ) : undefined;

  const changes = (record.changes ?? []).map((change) => {
    const label = t(`resultCard.record.field.${change.key}`, { defaultValue: change.key });
    const value = TRANSLATED_VALUES.has(change.value) ? t(`resultCard.record.value.${change.value}`) : change.value;
    return `${label}: ${value}`;
  });
  const details = [
    record.date ? formatDate(record.date, locale, {}, timeZone) : undefined,
    // A status change has its badge in the corner, so its amount moves down here
    tone ? figure : undefined,
    ...changes,
  ].filter((detail): detail is string => Boolean(detail));
  // A record without a name (settings, profile) shows its details right under the title
  const detailsInHeader = !subtitle && details.length > 0;

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        icon={recordIcon(record.type, action)}
        title={title}
        subtitle={
          subtitle ? (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {dot && <i className="inline-block w-2 h-2 rounded-full flex-none" style={{ background: dot }} aria-hidden="true" />}
              <span className="break-words">{subtitle}</span>
            </span>
          ) : detailsInHeader ? (
            <span className="break-words">{details.join(' · ')}</span>
          ) : undefined
        }
        aside={aside}
      />
      {((details.length > 0 && !detailsInHeader) || typeof record.billable === 'boolean') && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3 pl-0 min-[480px]:pl-[60px] text-caption text-secondary">
          {!detailsInHeader && details.map((detail, index) => <span key={index}>{detail}</span>)}
          {record.billable === true && <Badge tone="success">{t('taskList.billable')}</Badge>}
          {record.billable === false && <Badge tone="neutral">{t('taskList.nonBillable')}</Badge>}
        </div>
      )}
      {record.text && (
        <p className="m-0 mt-3 pl-0 min-[480px]:pl-[60px] text-body-small text-text-primary whitespace-pre-line break-words">
          {record.text}
        </p>
      )}
    </Card>
  );
}

function ResultCardApp() {
  const { t } = useTranslation();
  const result = useToolOutput<Result>();
  const failure = useToolFailure();

  if (failure) {
    return <StatusCard status={failure} />;
  }

  if (!result || !('kind' in result)) {
    return <Skeleton label={t('common.loading')} />;
  }
  if (result.kind === 'export' && result.export) {
    return <ExportCard result={result.export} />;
  }
  if (result.kind === 'absence' && result.absence) {
    return <AbsenceCard result={result} />;
  }
  if (result.kind === 'record' && result.record) {
    return <RecordCard result={result} />;
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
