/**
 * NoteForm - Add note to current task
 * Adapted from browser-extensions NoteForm component
 */

import React, {useState} from 'react';
import {useForm, FormProvider} from 'react-hook-form';
import {format} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTaskOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormattedMessage from '../../shared/FormattedMessage';
import {useTranslation} from 'react-i18next';

export default function NoteForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm();
  const {timer, settings, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const taskOps = useTaskOperations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (formValues: any) => {
    setError(null);
    setLoading(true);

    try {
      // Combine date and time into ISO string
      const dateTime = new Date(`${formValues.date}T${formValues.time}`);
      dateTime.setSeconds(0, 0);

      await taskOps.addNote({
        text: formValues.description,
        dateTime: dateTime.toISOString(),
      });

      // Reload timer
      await reloadTimer();

      // Go back to timer view
      goBack();
    } catch (err) {
      console.error('Failed to add note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  if (!timer?.task || !settings.dateFormat) {
    return <Spinner />;
  }

  return (
    <div className="w-full flex-auto grow">
      {loading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <Spinner />
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <FormattedMessage id="noteSaving" defaultMessage="Saving note..." />
          </p>
        </div>
      ) : (
        <FormProvider {...formMethods}>
          <form
            onSubmit={formMethods.handleSubmit(onSubmit)}
            className="p-4 grid grid-cols-2 gap-y-2 gap-x-4 divide-gray-200"
          >
            {error && (
              <div className="col-span-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                <strong className="font-semibold">Error: </strong>
                {error}
              </div>
            )}
            <Input
              id="date"
              type="date"
              validation={{required: true}}
              defaultValue={format(new Date(), 'yyyy-MM-dd')}
              min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
              className="text-sm"
              label={t('noteDate', 'Date')}
            />
            <Input
              id="time"
              type="time"
              validation={{required: true}}
              className="text-sm"
              defaultValue={format(new Date(), 'HH:mm')}
              label={t('noteTime', 'Time')}
            />
            <Textarea
              id="description"
              wrapperClasses="col-span-2"
              validation={{
                required: t('noteDescriptionRequired', 'Description is required'),
              }}
              label={t('description', 'Description')}
              rows={4}
            />
            <div className="pt-2 col-span-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => goBack()}
                  className="bg-white dark:bg-gray-800 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FormattedMessage id="cancel" defaultMessage="Cancel" />
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-submit-button hover:bg-submit-button-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FormattedMessage id="noteCreate" defaultMessage="Create Note" />
                </button>
              </div>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
