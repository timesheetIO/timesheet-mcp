import React from 'react';
import {useTranslation} from 'react-i18next';

type Props = {
  id: string;
  defaultMessage?: string;
  values?: Record<string, any>;
};

/**
 * FormattedMessage component using react-i18next
 * Provides internationalization support for the UI
 */
export default function FormattedMessage({id, defaultMessage, values}: Props): JSX.Element {
  const {t} = useTranslation();

  return <>{t(id, defaultMessage || id, values)}</>;
}
