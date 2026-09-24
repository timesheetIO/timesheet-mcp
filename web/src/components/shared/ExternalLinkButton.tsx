/**
 * ExternalLinkButton - opens a page of the web app through the host. A sandboxed widget
 * cannot navigate itself, and hosts confirm external links with the user. When the host
 * refuses the link, the URL is offered to copy instead.
 */

import React, { useState } from 'react';
import { ExternalLinkIcon } from '@heroicons/react/outline';
import { useOpenLink } from '../../hooks';
import LinkFallback from './LinkFallback';

export default function ExternalLinkButton({ url, children }: { url: string; children: React.ReactNode }) {
  const openLink = useOpenLink();
  const [refused, setRefused] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={async () => setRefused(!(await openLink(url)))}
        className="flex items-center justify-center gap-1 w-full min-h-[44px] text-body-small text-accent-text hover:underline bg-transparent border-0 cursor-pointer"
      >
        <span>{children}</span>
        <ExternalLinkIcon className="w-4 h-4" aria-hidden="true" />
      </button>
      {refused && (
        <div className="pb-3">
          <LinkFallback url={url} />
        </div>
      )}
    </>
  );
}
