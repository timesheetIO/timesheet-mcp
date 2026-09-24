/**
 * LinkFallback - the URL of a link the host would not open, to copy and open by hand.
 */

import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ActionRow';

export default function LinkFallback({ url }: { url: string }) {
  const { t } = useTranslation();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    } catch {
      // Sandboxed frames often may not write the clipboard: select the text instead
    }
    input.current?.focus();
    input.current?.select();
    try {
      setCopied(document.execCommand('copy'));
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-2 text-left" role="status">
      <label htmlFor={inputId} className="text-body-small text-secondary">
        {t('common.linkBlocked')}
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={inputId}
          type="url"
          readOnly
          value={url}
          onFocus={event => event.currentTarget.select()}
          className="min-w-0 flex-1 min-h-[44px] rounded-xl border border-border bg-background-primary px-3 text-sm text-text-primary"
        />
        <Button className="flex-none" onClick={copy}>
          {copied ? t('common.copied') : t('common.copyLink')}
        </Button>
      </div>
    </div>
  );
}
