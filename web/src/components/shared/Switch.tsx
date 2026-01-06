/**
 * Switch - Toggle switch component
 * Reusable form toggle with react-hook-form and HeadlessUI integration
 */

import React from 'react';
import {Switch} from '@headlessui/react';
import {classNames} from '../../utils/lib';
import {useFormContext, type RegisterOptions} from 'react-hook-form';

interface Props {
  label: string;
  id: string;
  readOnly?: boolean;
  validation?: RegisterOptions;
  wrapperClasses?: string;
  [prop: string]: any;
}

export default function SwitchComponent({
  label,
  id,
  validation = {},
  readOnly = false,
  wrapperClasses = '',
}: Props): JSX.Element {
  const {register, setValue, watch} = useFormContext();

  const enabled = watch(id, false);

  return (
    <Switch.Group as="div" className={classNames('flex items-center', wrapperClasses)}>
      <Switch
        checked={enabled}
        onChange={v => setValue(id, v)}
        className={classNames(
          enabled ? 'bg-primary/100' : 'bg-gray-200 dark:bg-gray-700',
          'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50'
        )}
      >
        <input
          id={id}
          name={id}
          {...register(id, validation)}
          type="checkbox"
          className="hidden"
          readOnly={readOnly}
        />
        <span
          className={classNames(
            enabled ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
          )}
        >
          <span
            className={classNames(
              enabled
                ? 'opacity-0 ease-out duration-100'
                : 'opacity-100 ease-in duration-200',
              'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
            )}
            aria-hidden="true"
          >
            <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
              <path
                d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className={classNames(
              enabled
                ? 'opacity-100 ease-in duration-200'
                : 'opacity-0 ease-out duration-100',
              'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
            )}
            aria-hidden="true"
          >
            <svg className="h-3 w-3 text-primary/60" fill="currentColor" viewBox="0 0 12 12">
              <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
            </svg>
          </span>
        </span>
      </Switch>
      <Switch.Label as="span" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
        {label}
      </Switch.Label>
    </Switch.Group>
  );
}
