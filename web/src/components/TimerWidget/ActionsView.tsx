/**
 * ActionsView - the timer's secondary actions as a plain list. It replaces the dropdown menu,
 * which a host clips inside an inline widget. When the host supports it, the widget switches
 * to fullscreen for this view and the forms behind it.
 */

import React from 'react';
import {useTranslation} from 'react-i18next';
import {ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/outline';
import {FaCoffee, FaRegEdit, FaRegFile, FaWallet} from 'react-icons/fa';
import {useViewRouter, type ViewType} from './ViewRouter';
import Card from '../shared/Card';

const ACTIONS: Array<{view: ViewType; label: string; icon: React.ReactNode}> = [
  {view: 'task/edit', label: 'timerWidget.actions.editTask', icon: <FaRegEdit />},
  {view: 'pause/new', label: 'timerWidget.actions.addBreak', icon: <FaCoffee />},
  {view: 'expense/new', label: 'timerWidget.actions.addExpense', icon: <FaWallet />},
  {view: 'note/new', label: 'timerWidget.actions.addNote', icon: <FaRegFile />},
];

export default function ActionsView() {
  const {t} = useTranslation();
  const {navigate, goBack} = useViewRouter();

  return (
    <Card tone="plain" className="p-2">
      <button type="button" className="ts-link-button px-2" onClick={goBack}>
        <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
        {t('common.back')}
      </button>
      <ul className="list-none m-0 p-0">
        {ACTIONS.map(action => (
          <li key={action.view}>
            <button
              type="button"
              onClick={() => navigate(action.view)}
              className="flex items-center gap-3 w-full min-h-[44px] px-3 rounded-md text-left text-body text-text-primary hover:bg-background-secondary"
            >
              <span className="w-4 h-4 text-accent-text [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">{action.icon}</span>
              <span className="flex-1">{t(action.label)}</span>
              <ChevronRightIcon className="w-4 h-4 text-secondary" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
