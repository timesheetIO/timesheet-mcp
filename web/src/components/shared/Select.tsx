/**
 * Select - Dropdown select component
 * Reusable form select with react-hook-form and HeadlessUI integration
 */

import React, {Fragment, useEffect, useState} from 'react';
import {type RegisterOptions, useFormContext} from 'react-hook-form';
import {Listbox, Transition} from '@headlessui/react';
import {CheckIcon, SelectorIcon} from '@heroicons/react/solid';
import {classNames} from '../../utils/lib';

export interface SelectOption {
  key: string;
  value: string | number;
  label: string;
}

interface Props {
  label: string;
  id: string;
  readOnly?: boolean;
  validation?: RegisterOptions;
  className?: string;
  options: SelectOption[];
}

export default function Select({
  label,
  id,
  readOnly = false,
  validation = {},
  className = '',
  options,
}: Props): JSX.Element {
  const {
    register,
    formState: {errors},
    setValue,
    watch,
  } = useFormContext();

  const [selected, setSelected] = useState(options[0]);

  useEffect(() => {
    const subscription = watch((data, {name}) => {
      if (name === id && selected.value !== data[id]) {
        const newSelected = options.find(o => o.value === data[id]);
        if (newSelected) {
          setSelected(newSelected);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, id, selected, options]);

  return (
    <Listbox
      value={selected}
      onChange={newValue => {
        setValue(id, newValue.value);
        setSelected(newValue);
      }}
    >
      {({open}) => (
        <div className={className}>
          <input
            type="text"
            className="hidden"
            {...register(id, validation)}
            id={id}
            name={id}
            aria-invalid={!!errors[id] ? 'true' : 'false'}
          />
          <Listbox.Label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Listbox.Label>
          <div className="mt-1 relative">
            <Listbox.Button className="bg-white dark:bg-gray-800 relative w-full border border-gray-300 dark:border-gray-600 rounded-xl pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/100 focus:border-primary/100 text-sm text-gray-900 dark:text-gray-100 min-h-[38px]">
              <span className="block min-h-5 truncate">{selected?.label}</span>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <SelectorIcon
                  className="h-5 w-5 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 mb-2 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-xl py-1 text-sm ring-1 ring-black dark:ring-gray-600 ring-opacity-5 overflow-auto focus:outline-none">
                {options.map(option => (
                  <Listbox.Option
                    key={option.key}
                    className={({active}) =>
                      classNames(
                        active
                          ? 'text-white bg-primary/100'
                          : 'text-gray-900 dark:text-gray-100',
                        'cursor-pointer select-none relative py-2 pl-3 pr-9'
                      )
                    }
                    value={option}
                  >
                    {({active}) => (
                      <>
                        <span
                          className={classNames(
                            selected.value === option.value ? 'font-semibold' : 'font-normal',
                            'block truncate'
                          )}
                        >
                          {option.label}
                        </span>

                        {selected?.value === option.value ? (
                          <span
                            className={classNames(
                              active ? 'text-white' : 'text-primary/100',
                              'absolute inset-y-0 right-0 flex items-center pr-4'
                            )}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )}
    </Listbox>
  );
}
