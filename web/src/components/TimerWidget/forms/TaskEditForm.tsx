/**
 * TaskEditForm - Edit current running task
 * Adapted from browser-extensions TaskForm component
 */

import React, {useEffect, useState} from 'react';
import {useForm, FormProvider, useWatch} from 'react-hook-form';
import {format} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTimerOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Select from '../../shared/Select';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormattedMessage from '../../shared/FormattedMessage';
import {useTranslation} from 'react-i18next';

export default function TaskEditForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm();
  const {timer, settings, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const timerOps = useTimerOperations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchType = useWatch({control: formMethods.control, name: 'typeId', defaultValue: '0'});

  useEffect(() => {
    if (timer?.task) {
      formMethods.setValue('description', timer.task.description || '');
      formMethods.setValue(
        'startDate',
        format(new Date(timer.task.startDateTime || Date.now()), 'yyyy-MM-dd')
      );
      formMethods.setValue(
        'startTime',
        format(new Date(timer.task.startDateTime || Date.now()), 'HH:mm')
      );
      formMethods.setValue('typeId', `${timer.task.typeId || 0}`);
      formMethods.setValue('location', timer.task.location || '');
      formMethods.setValue('locationEnd', timer.task.locationEnd || '');
      formMethods.setValue('distance', timer.task.distance || '');
      formMethods.setValue('phoneNumber', timer.task.phoneNumber || '');
    }
  }, [timer, formMethods]);

  const onSubmit = async (formValues: any) => {
    setError(null);
    setLoading(true);

    try {
      // Combine date and time into ISO string
      const startDateTime = new Date(`${formValues.startDate}T${formValues.startTime}`);
      startDateTime.setSeconds(0, 0);

      await timerOps.update({
        description: formValues.description,
        // Add other fields as supported by timer_update
      });

      // Reload timer
      await reloadTimer();

      // Go back to timer view
      goBack();
    } catch (err) {
      console.error('Failed to update task:', err);
      setError(err instanceof Error ? err.message : 'Failed to save task');
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
            <FormattedMessage id="taskSaving" defaultMessage="Saving task..." />
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
              defaultValue={format(new Date(), 'yyyy-MM-dd')}
              min={format(new Date(timer.task.startDateTime || 0), 'yyyy-MM-dd')}
              className="text-sm"
              label={t('taskStartDate', 'Start Date')}
            />
            <Input
              id="startTime"
              type="time"
              validation={{required: true}}
              className="text-sm"
              defaultValue={format(new Date(), 'HH:mm')}
              label={t('taskStartTime', 'Start Time')}
            />
            <Textarea
              id="description"
              wrapperClasses="col-span-2"
              label={t('noteDescription', 'Description')}
              rows={4}
            />
            <Select
              id="typeId"
              validation={{required: true}}
              label={t('taskType', 'Type')}
              options={[
                {key: 'task-0', value: '0', label: 'Task'},
                {key: 'mileage-1', value: '1', label: 'Mileage'},
                {key: 'call-2', value: '2', label: 'Call'},
              ]}
            />
            <Input
              id="location"
              type="text"
              className="text-sm"
              validation={{required: watchType === '1'}}
              label={t(
                watchType === '1' ? 'taskLocationStart' : 'taskLocation',
                'Location'
              )}
            />
            {watchType === '2' && (
              <Input
                id="phoneNumber"
                type="tel"
                className="text-sm"
                wrapperClasses="col-span-2"
                validation={{required: true}}
                label={t('taskPhoneNumber', 'Phone Number')}
              />
            )}
            {watchType === '1' && (
              <>
                <Input
                  id="locationEnd"
                  type="text"
                  className="text-sm"
                  validation={{required: true}}
                  label={t('taskLocationEnd', 'End Location')}
                />
                <Input
                  id="distance"
                  type="number"
                  className="text-sm"
                  validation={{required: true, min: 0}}
                  label={t('taskDistance', 'Distance')}
                />
              </>
            )}
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
                  <FormattedMessage id="taskCreate" defaultMessage="Save Task" />
                </button>
              </div>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
