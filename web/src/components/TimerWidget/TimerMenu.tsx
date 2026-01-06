/**
 * TimerMenu - Dropdown menu for timer actions
 * Provides options to edit task, add pause, add expense, add note
 */

import React, {Fragment} from 'react';
import {Menu, Transition} from '@headlessui/react';
import {DotsVerticalIcon} from '@heroicons/react/outline';
import {FaCoffee, FaRegEdit, FaRegFile, FaWallet} from 'react-icons/fa';
import {classNames} from '../../utils/lib';
import {useViewRouter} from './ViewRouter';
import FormattedMessage from '../shared/FormattedMessage';

export default function TimerMenu() {
  const {navigate} = useViewRouter();

  return (
    <Menu as="div" className="ml-3 relative z-10">
      <div>
        <Menu.Button className="flex text-sm rounded-full hover:text-primary/100 focus:outline-none focus:ring-primary/0 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
          <span className="sr-only">Options</span>
          <DotsVerticalIcon className="h-6 w-6" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none">
          <Menu.Item>
            {({active}) => (
              <button
                onClick={() => navigate('task/edit')}
                className={classNames(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 align-middle items-center'
                )}
              >
                <FaRegEdit className="w-4 h-4" aria-hidden={true} />
                <span className="ml-2">
                  <FormattedMessage id="taskEdit" defaultMessage="Edit Task" />
                </span>
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({active}) => (
              <button
                onClick={() => navigate('pause/new')}
                className={classNames(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 align-middle items-center'
                )}
              >
                <FaCoffee className="w-4 h-4" aria-hidden={true} />
                <span className="ml-2">
                  <FormattedMessage id="pauseNew" defaultMessage="New Pause" />
                </span>
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({active}) => (
              <button
                onClick={() => navigate('expense/new')}
                className={classNames(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 align-middle items-center'
                )}
              >
                <FaWallet className="w-4 h-4" aria-hidden={true} />
                <span className="ml-2">
                  <FormattedMessage id="expenseNew" defaultMessage="New Expense" />
                </span>
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({active}) => (
              <button
                onClick={() => navigate('note/new')}
                className={classNames(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 align-middle items-center'
                )}
              >
                <FaRegFile className="w-4 h-4" aria-hidden={true} />
                <span className="ml-2">
                  <FormattedMessage id="noteNew" defaultMessage="New Note" />
                </span>
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
