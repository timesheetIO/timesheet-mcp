/**
 * ProjectSelector - Combobox for selecting projects
 * Adapted from browser-extensions ProjectSelector component
 */

import React, {Fragment, useState} from 'react';
import {Combobox, Transition} from '@headlessui/react';
import {CheckIcon, SelectorIcon} from '@heroicons/react/solid';
import {classNames} from '../../../utils/lib';
import {useData} from '../DataProvider';
import FormattedMessage from '../../shared/FormattedMessage';
import type {Project} from '@timesheet/sdk';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string) => void;
  error?: string;
}

export default function ProjectSelector({value, onChange, error}: ProjectSelectorProps) {
  const {projects, selectedProject} = useData();
  const [query, setQuery] = useState('');

  const filtered =
    query === ''
      ? projects || []
      : (projects || []).filter((p: Project) =>
          p.title
            .toLowerCase()
            .replace(/\s+/g, '')
            .includes(query.replace(/\s+/g, '').toLocaleLowerCase())
        );

  return (
    <Combobox value={value || selectedProject || ''} onChange={onChange}>
      {({open}) => (
        <div className="col-span-2">
          <Combobox.Label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            <FormattedMessage id="projectSelect" defaultMessage="Select Project" />
          </Combobox.Label>
          <div className="mt-1 relative">
            <div className="relative w-full text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer focus-within:ring-1 focus-within:ring-primary/100 focus-within:border-primary/100 sm:text-sm overflow-hidden">
              <Combobox.Input
                onChange={e => setQuery(e.target.value)}
                displayValue={(id: string) =>
                  projects.find(p => p.id === id)?.title || ''
                }
                className="w-full border-none focus:ring-0 focus:outline-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 dark:text-gray-100 bg-transparent"
                onFocus={event => {
                  requestAnimationFrame(() => {
                    event.target.setSelectionRange(0, event.target.value.length);
                  });
                }}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                <SelectorIcon
                  className="h-5 w-5 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
              </Combobox.Button>
            </div>
            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Combobox.Options className="absolute z-10 mt-1 mb-2 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-xl py-1 text-sm ring-1 ring-black dark:ring-gray-600 ring-opacity-5 overflow-auto focus:outline-none">
                {filtered.length === 0 && query !== '' ? (
                  <div className="cursor-pointer select-none relative py-2 px-4 text-gray-700 dark:text-gray-300">
                    <FormattedMessage
                      id="nothingFound"
                      defaultMessage="Nothing found."
                    />
                  </div>
                ) : (
                  filtered.map(project => (
                    <Combobox.Option
                      key={project.id}
                      className={({active}) =>
                        classNames(
                          active
                            ? 'text-white bg-primary/100'
                            : 'text-gray-900 dark:text-gray-100',
                          'cursor-pointer select-none relative py-2 pl-3 pr-9'
                        )
                      }
                      value={project.id}
                    >
                      {({selected, active}) => (
                        <>
                          <span className="block">
                            <span
                              className={classNames(
                                selected ? 'font-semibold' : 'font-normal',
                                'block truncate'
                              )}
                            >
                              {project.title}
                            </span>
                            {project.employer && (
                              <span
                                className={classNames(
                                  'block truncate text-xs',
                                  active ? 'text-gray-50' : 'text-gray-600 dark:text-gray-400'
                                )}
                              >
                                {project.employer}
                              </span>
                            )}
                          </span>

                          {selected ? (
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
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
          {error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </Combobox>
  );
}
