/**
 * PauseForm - Add manual pause/break to current task
 * Adapted from browser-extensions PauseForm component
 */

import React, {useMemo, useState} from 'react';
import {useForm, FormProvider} from 'react-hook-form';
import {format, sub, differenceInMinutes} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTaskOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormattedMessage from '../../shared/FormattedMessage';
import {useTranslation} from 'react-i18next';

export default function PauseForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm();
  const {timer, settings, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const taskOps = useTaskOperations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate initial pause start time
  const initialPauseTimes = useMemo(() => {
    if (!timer?.task?.startDateTime || !settings?.defaultBreakDuration) {
      return {
        startDateTime: new Date(),
        endDateTime: new Date(),
      };
    }

    const now = new Date();
    const taskStart = new Date(timer.task.startDateTime);
    const taskDuration = differenceInMinutes(now, taskStart);
    const defaultBreakMinutes = settings.defaultBreakDuration;

    // If task duration > default break duration, subtract break duration from now
    // Otherwise, use task start time
    const pauseStart =
      taskDuration > defaultBreakMinutes
        ? sub(now, {minutes: defaultBreakMinutes})
        : taskStart;

    return {
      startDateTime: pauseStart,
      endDateTime: now,
    };
  }, [timer?.task?.startDateTime, settings?.defaultBreakDuration]);

  // Validate pause times are within task boundaries
  const validatePauseTimes = (formValues: any): boolean => {
    if (!timer?.task?.startDateTime) {
      setError('No active task found');
      return false;
    }

    const taskStart = new Date(timer.task.startDateTime);
    const taskEnd = timer.task.endDateTime ? new Date(timer.task.endDateTime) : new Date();

    // Combine date and time inputs
    const pauseStart = new Date(`${formValues.startDate}T${formValues.startTime}`);
    const pauseEnd = new Date(`${formValues.endDate}T${formValues.endTime}`);

    // Check if pause start is before task start
    if (pauseStart < taskStart) {
      setError(t('pauseStartBeforeTask', 'Pause start time cannot be before task start time'));
      return false;
    }

    // Check if pause end is after task end (or current time if task is running)
    if (pauseEnd > taskEnd) {
      setError(t('pauseEndAfterTask', 'Pause end time cannot be after task end time'));
      return false;
    }

    // Check if pause start is after pause end
    if (pauseStart >= pauseEnd) {
      setError(t('pauseStartAfterEnd', 'Pause start time must be before end time'));
      return false;
    }

    return true;
  };

  const onSubmit = async (formValues: any) => {
    setError(null);

    // Validate pause times
    if (!validatePauseTimes(formValues)) {
      return;
    }

    setLoading(true);

    try {
      // Combine date and time into ISO strings
      const startDateTime = new Date(`${formValues.startDate}T${formValues.startTime}`);
      startDateTime.setSeconds(0, 0);
      const endDateTime = new Date(`${formValues.endDate}T${formValues.endTime}`);
      endDateTime.setSeconds(0, 0);

      await taskOps.addPause({
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        description: formValues.description,
      });

      // Reload timer
      await reloadTimer();

      // Go back to timer view
      goBack();
    } catch (err) {
      console.error('Failed to add pause:', err);
      setError(err instanceof Error ? err.message : 'Failed to save pause');
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
            <FormattedMessage id="pauseSaving" defaultMessage="Saving pause..." />
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
              id="startDate"
              type="date"
              validation={{required: true}}
              defaultValue={format(initialPauseTimes.startDateTime, 'yyyy-MM-dd')}
              min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
              max={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
              className="text-sm"
              label={t('pauseStartDate', 'Pause Start Date')}
            />
            <Input
              id="startTime"
              type="time"
              validation={{required: true}}
              className="text-sm"
              defaultValue={format(initialPauseTimes.startDateTime, 'HH:mm')}
              label={t('pauseStartTime', 'Pause Start Time')}
            />
            <Input
              id="endDate"
              type="date"
              className="text-sm"
              validation={{required: true}}
              defaultValue={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
              min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
              max={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
              label={t('pauseEndDate', 'Pause End Date')}
            />
            <Input
              id="endTime"
              type="time"
              className="text-sm"
              validation={{required: true}}
              defaultValue={format(initialPauseTimes.endDateTime, 'HH:mm')}
              label={t('pauseEndTime', 'Pause End Time')}
            />
            <Textarea
              id="description"
              wrapperClasses="col-span-2"
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
                  <FormattedMessage id="pauseCreate" defaultMessage="Create Pause" />
                </button>
              </div>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
