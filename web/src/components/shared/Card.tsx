/**
 * Card - the widget surface, in the look of the demo's result cards
 */

import React from 'react';
import { classNames } from '../../utils/lib';

interface CardProps {
  /** accent: orange tinted result card. plain: neutral surface for lists and forms */
  tone?: 'accent' | 'plain';
  className?: string;
  children: React.ReactNode;
}

export default function Card({ tone = 'accent', className, children }: CardProps) {
  return (
    <section className={classNames('ts-card', tone === 'accent' && 'ts-card-accent', className)}>
      {children}
    </section>
  );
}
