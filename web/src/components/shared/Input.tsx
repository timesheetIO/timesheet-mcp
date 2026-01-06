/**
 * Input - Text input component with validation
 * Reusable form input with react-hook-form integration
 */

import React, {useState} from 'react';
import {type RegisterOptions, useFormContext} from 'react-hook-form';
import {classNames} from '../../utils/lib';
import {FaRegEye, FaRegEyeSlash} from 'react-icons/fa';
import {ExclamationCircleIcon} from '@heroicons/react/solid';

interface Props {
  label: string;
  placeholder?: string;
  helperText?: string;
  id: string;
  type?: string;
  prepend?: React.ReactElement | null;
  readOnly?: boolean;
  validation?: RegisterOptions;
  wrapperClasses?: string;
  className?: string;
  [prop: string]: any;
}

export default function Input({
  label,
  placeholder = '',
  helperText = '',
  id,
  type = 'text',
  prepend = null,
  readOnly = false,
  validation = {},
  wrapperClasses,
  className,
  ...rest
}: Props): JSX.Element {
  const {
    register,
    formState: {errors},
  } = useFormContext();
  const [passwordHidden, setPasswordHidden] = useState(true);

  const getClasses = (): string => {
    let classes =
      'block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

    // Add theme support for date/time/datetime-local inputs
    if (type === 'date' || type === 'time' || type === 'datetime-local') {
      classes += ' [color-scheme:light] dark:[color-scheme:dark]';
    }

    // Special padding for error states, password fields, and fields with prepend icons
    if (!!errors[id] || type === 'password') {
      classes += ' py-2 pl-10 pr-10';
    } else if (!!prepend) {
      // Extra left padding for prepend elements (currency codes, icons)
      classes += ' py-2 pl-14 pr-3';
    } else {
      // Normal padding for regular inputs
      classes += ' px-3 py-2';
    }

    if (readOnly) {
      classes +=
        ' focus:text-black dark:focus:text-white focus:border-primary/100 focus:ring-primary/100';
    } else if (!!errors[id]) {
      classes +=
        ' border-red-300 dark:border-red-600 text-red-900 dark:text-red-400 placeholder-red-300 dark:placeholder-red-500 focus:outline-none focus:ring-red-500 focus:border-red-500';
    } else {
      classes +=
        ' focus:text-black dark:focus:text-white focus:border-primary/100 focus:ring-primary/100';
    }

    return classes;
  };

  return (
    <div className={wrapperClasses}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <div className="relative mt-1 min-h-5">
        {prepend && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pr-2">
            {prepend}
          </div>
        )}
        <input
          {...register(id, validation)}
          {...rest}
          type={type !== 'password' || passwordHidden ? type : 'text'}
          name={id}
          id={id}
          readOnly={readOnly}
          className={classNames(getClasses(), className)}
          placeholder={placeholder}
          aria-invalid={!!errors[id] ? 'true' : 'false'}
          aria-describedby={!!errors[id] ? `${id}-error` : id}
        />

        {!!errors[id] ? (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ExclamationCircleIcon
              className="h-5 w-5 text-red-500 dark:text-red-400"
              aria-hidden="true"
            />
          </div>
        ) : type === 'password' ? (
          <button
            type="button"
            onClick={() => {
              setPasswordHidden(!passwordHidden);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            {passwordHidden ? (
              <FaRegEye className="text-xl" />
            ) : (
              <FaRegEyeSlash className="text-xl" />
            )}
          </button>
        ) : null}
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
