/**
 * FormLayout - the frame of the timer's forms: the error, the fields and the two actions.
 * The form stays on screen while it saves and after a failed save, so nothing the user typed
 * is lost.
 */

import React from 'react';
import {FormProvider, type FieldValues, type UseFormReturn} from 'react-hook-form';
import {useTranslation} from 'react-i18next';

interface FormLayoutProps<T extends FieldValues> {
  methods: UseFormReturn<T>;
  onSubmit: (values: T) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  savingLabel: string;
  children: React.ReactNode;
}

export default function FormLayout<T extends FieldValues>({
  methods,
  onSubmit,
  onCancel,
  saving,
  error,
  submitLabel,
  savingLabel,
  children,
}: FormLayoutProps<T>) {
  const {t} = useTranslation();

  return (
    <div className="w-full flex-auto grow">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="p-4 grid grid-cols-2 gap-y-2 gap-x-4"
          aria-busy={saving}
        >
          {error && (
            <div
              role="alert"
              className="col-span-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded-md text-sm"
            >
              <strong className="font-semibold">{t('common.error')}: </strong>
              {error}
            </div>
          )}
          {children}
          <div className="pt-2 col-span-2 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={saving} className="ts-button">
              {t('forms.cancel')}
            </button>
            <button type="submit" disabled={saving} className="ts-button ts-button-primary">
              {saving ? savingLabel : submitLabel}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
