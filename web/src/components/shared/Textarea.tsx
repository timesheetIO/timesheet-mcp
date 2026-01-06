/**
 * Textarea - Multi-line text input component
 * Reusable form textarea with react-hook-form integration
 */

import React from 'react';
import {type RegisterOptions, useFormContext} from 'react-hook-form';
import {classNames} from '../../utils/lib';

interface Props {
  label: string;
  id: string;
  placeholder?: string;
  helperText?: string;
  rows?: number;
  validation?: RegisterOptions;
  wrapperClasses?: string;
  className?: string;
  [prop: string]: any;
}

export default function Textarea({
  label,
  id,
  placeholder = '',
  helperText = '',
  rows = 4,
  validation = {},
  wrapperClasses,
  className,
  ...rest
}: Props): JSX.Element {
  const {
    register,
    formState: {errors},
  } = useFormContext();

  return (
    <div className={wrapperClasses}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <div className="mt-1">
        <textarea
          {...register(id, validation)}
          {...rest}
          id={id}
          name={id}
          rows={rows}
          className={classNames(
            'focus:ring-primary/100 focus:border-primary/100 block w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl resize-none px-3 py-2',
            !!errors[id] &&
              'border-red-300 dark:border-red-600 text-red-900 dark:text-red-400 focus:ring-red-500 focus:border-red-500',
            className
          )}
          placeholder={placeholder}
          aria-invalid={!!errors[id] ? 'true' : 'false'}
          aria-describedby={!!errors[id] ? `${id}-error` : id}
        />
      </div>
      <div className="mt-1">
        {helperText !== '' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
        {errors[id] && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" id={`${id}-error`}>
            {String(errors[id]?.message || 'Invalid input')}
          </p>
        )}
      </div>
    </div>
  );
}
