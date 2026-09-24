/**
 * PauseForm - Add manual pause/break to current task
 * Adapted from browser-extensions PauseForm component
 */

import React, {useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';
import {format, sub, differenceInMinutes} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTaskOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormLayout from './FormLayout';
import {useTranslation} from 'react-i18next';
import {toOffsetISOString} from '../../../format';

export default function PauseForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm();
  const {timer, settings, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const taskOps = useTaskOperations();
  const [saving, setSaving] = useState(false);
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
      setError(t('forms.noActiveTask'));
      return false;
    }

    const taskStart = new Date(timer.task.startDateTime);
    const taskEnd = timer.task.endDateTime ? new Date(timer.task.endDateTime) : new Date();

    // Combine date and time inputs
    const pauseStart = new Date(`${formValues.startDate}T${formValues.startTime}`);
    const pauseEnd = new Date(`${formValues.endDate}T${formValues.endTime}`);

    // Check if pause start is before task start
    if (pauseStart < taskStart) {
      setError(t('forms.pauseStartBeforeTask'));
      return false;
    }

    // Check if pause end is after task end (or current time if task is running)
    if (pauseEnd > taskEnd) {
      setError(t('forms.pauseEndAfterTask'));
      return false;
    }

    // Check if pause start is after pause end
    if (pauseStart >= pauseEnd) {
      setError(t('forms.pauseStartAfterEnd'));
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

    setSaving(true);

    try {
      // Combine date and time into ISO strings
      const startDateTime = new Date(`${formValues.startDate}T${formValues.startTime}`);
      startDateTime.setSeconds(0, 0);
      const endDateTime = new Date(`${formValues.endDate}T${formValues.endTime}`);
      endDateTime.setSeconds(0, 0);

      await taskOps.addPause({
        startDateTime: toOffsetISOString(startDateTime),
        endDateTime: toOffsetISOString(endDateTime),
        description: formValues.description,
      });
    } catch (err) {
      // The form stays as it is, with what the user typed
      console.error('Failed to add pause:', err);
      setError(t('forms.saveFailed.pause'));
      setSaving(false);
      return;
    }

    // The break is saved: a timer that could not be reloaded only shows older numbers
    await reloadTimer().catch(err => console.error('Failed to reload the timer:', err));
    goBack();
  };

  if (!timer?.task || !settings.dateFormat) {
    return <Spinner />;
  }

  return (
    <FormLayout
      methods={formMethods}
      onSubmit={onSubmit}
      onCancel={goBack}
      saving={saving}
      error={error}
      submitLabel={t('forms.submit.pause')}
      savingLabel={t('forms.saving.pause')}
    >
      <Input
        id="startDate"
        type="date"
        validation={{required: true}}
        defaultValue={format(initialPauseTimes.startDateTime, 'yyyy-MM-dd')}
        min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
        max={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
        className="text-sm"
        label={t('forms.pauseStartDate')}
      />
      <Input
        id="startTime"
        type="time"
        validation={{required: true}}
        className="text-sm"
        defaultValue={format(initialPauseTimes.startDateTime, 'HH:mm')}
        label={t('forms.pauseStartTime')}
      />
      <Input
        id="endDate"
        type="date"
        className="text-sm"
        validation={{required: true}}
        defaultValue={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
        min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
        max={format(initialPauseTimes.endDateTime, 'yyyy-MM-dd')}
        label={t('forms.pauseEndDate')}
      />
      <Input
        id="endTime"
        type="time"
        className="text-sm"
        validation={{required: true}}
        defaultValue={format(initialPauseTimes.endDateTime, 'HH:mm')}
        label={t('forms.pauseEndTime')}
      />
      <Textarea
        id="description"
        wrapperClasses="col-span-2"
        label={t('forms.description')}
        rows={4}
      />
    </FormLayout>
  );
}
