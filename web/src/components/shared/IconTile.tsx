/**
 * IconTile - square tile holding the card's icon
 */

import React from 'react';

export default function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="ts-icon-tile" aria-hidden="true">
      <span className="w-5 h-5 [&>svg]:w-5 [&>svg]:h-5">{children}</span>
    </span>
  );
}
