/**
 * Buttons for card actions. An inline card shows at most two, with 44px tap targets.
 */

import React from 'react';
import { classNames } from '../../utils/lib';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}

export function Button({ variant = 'secondary', icon, className, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={classNames(
        'ts-button',
        variant === 'primary' && 'ts-button-primary',
        variant === 'danger' && 'ts-button-danger',
        className
      )}
      {...props}
    >
      {icon && <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}

export default function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 [&>*]:flex-1">{children}</div>;
}
