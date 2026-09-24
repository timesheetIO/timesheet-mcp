/**
 * TaskEditForm - Edit current running task
 * Adapted from browser-extensions TaskForm component
 */

import React, {useEffect, useRef, useState} from 'react';
import {useForm, useWatch} from 'react-hook-form';
import {format} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTimerOperations, type TimerUpdateParams} from '../../../utils/timesheet-hooks';
import {toOffsetISOString} from '../../../format';
import type {ExtendedTimer, TimerTask} from '../../../utils/types';
import Input from '../../shared/Input';
import Select from '../../shared/Select';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormLayout from './FormLayout';
import {useTranslation} from 'react-i18next';

/** The entry types of the API (typeId) */
const TYPE_OPTIONS = [
  {key: 'task-0', value: '0', label: 'forms.types.task'},
  {key: 'mileage-1', value: '1', label: 'forms.types.mileage'},
  {key: 'call-2', value: '2', label: 'forms.types.call'},
];

interface TaskFormValues {
  description: string;
  startDate: string;
  startTime: string;
  typeId: string;
  location: string;
  locationEnd: string;
  distance: string;
  phoneNumber: string;
}

/** The form's values for an entry, as the inputs hold them (strings) */
function valuesOf(task: TimerTask): TaskFormValues {
  const start = new Date(task.startDateTime || Date.now());
  return {
    description: task.description || '',
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    typeId: `${task.typeId || 0}`,
    location: task.location || '',
    locationEnd: task.locationEnd || '',
    distance: task.distance !== undefined && task.distance !== null ? `${task.distance}` : '',
    phoneNumber: task.phoneNumber || '',
  };
}

/** timer_update arguments for the fields the user changed */
function changesBetween(initial: TaskFormValues, values: TaskFormValues): TimerUpdateParams {
  const changes: TimerUpdateParams = {};
  const changed = (field: keyof TaskFormValues) => `${values[field] ?? ''}` !== initial[field];

  if (changed('description')) changes.description = values.description;
  if (changed('startDate') || changed('startTime')) {
    // ISO 8601 with the local offset: the API keeps the offset to show the entry in the user's time
    const start = new Date(`${values.startDate}T${values.startTime}`);
    start.setSeconds(0, 0);
    changes.startDateTime = toOffsetISOString(start);
  }
  if (changed('typeId')) changes.typeId = Number(values.typeId);
  if (changed('location')) changes.location = values.location;
  if (changed('locationEnd')) changes.locationEnd = values.locationEnd;
  if (changed('distance')) {
    const distance = parseFloat(`${values.distance}`);
    if (Number.isFinite(distance)) changes.distance = distance;
  }
  if (changed('phoneNumber')) changes.phoneNumber = values.phoneNumber;
  return changes;
}

export default function TaskEditForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm<TaskFormValues>();
  const {timer, settings, applyTimer, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const timerOps = useTimerOperations();
  const initial = useRef<TaskFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchType = useWatch({control: formMethods.control, name: 'typeId', defaultValue: '0'});

  useEffect(() => {
    if (timer?.task) {
      const values = valuesOf(timer.task);
      initial.current = values;
      (Object.keys(values) as Array<keyof TaskFormValues>).forEach(field => formMethods.setValue(field, values[field]));
    }
  }, [timer, formMethods]);

  const onSubmit = async (formValues: TaskFormValues) => {
    setError(null);
    const changes = initial.current ? changesBetween(initial.current, formValues) : {};
    if (Object.keys(changes).length === 0) {
      goBack();
      return;
    }

    setSaving(true);
    let updated: ExtendedTimer | undefined;
    try {
      updated = (await timerOps.update(changes)) as unknown as ExtendedTimer;
    } catch (err) {
      // The form stays as it is, with the user's changes
      console.error('Failed to update task:', err);
      setError(t('forms.saveFailed.task'));
      setSaving(false);
      return;
    }

    // timer_update returns the updated timer; ask for it only if an older server did not
    if (updated && 'status' in updated) {
      applyTimer(updated);
    } else {
      await reloadTimer().catch(err => console.error('Failed to reload the timer:', err));
    }
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
      submitLabel={t('forms.submit.task')}
      savingLabel={t('forms.saving.task')}
    >
      <Input
        id="startDate"
        type="date"
        validation={{required: true}}
        defaultValue={format(new Date(), 'yyyy-MM-dd')}
        // A running entry can start on an earlier day, never in the future
        max={format(new Date(), 'yyyy-MM-dd')}
        className="text-sm"
        label={t('forms.startDate')}
      />
      <Input
        id="startTime"
        type="time"
        validation={{required: true}}
        className="text-sm"
        defaultValue={format(new Date(), 'HH:mm')}
        label={t('forms.startTime')}
      />
      <Textarea
        id="description"
        wrapperClasses="col-span-2"
        label={t('forms.description')}
        rows={4}
      />
      <Select
        id="typeId"
        validation={{required: true}}
        label={t('forms.type')}
        options={TYPE_OPTIONS.map(option => ({...option, label: t(option.label)}))}
      />
      <Input
        id="location"
        type="text"
        className="text-sm"
        validation={{required: watchType === '1'}}
        label={t(watchType === '1' ? 'forms.locationStart' : 'forms.location')}
      />
      {watchType === '2' && (
        <Input
          id="phoneNumber"
          type="tel"
          className="text-sm"
          wrapperClasses="col-span-2"
          validation={{required: true}}
          label={t('forms.phoneNumber')}
        />
      )}
      {watchType === '1' && (
        <>
          <Input
            id="locationEnd"
            type="text"
            className="text-sm"
            validation={{required: true}}
            label={t('forms.locationEnd')}
          />
          <Input
            id="distance"
            type="number"
            step="any"
            className="text-sm"
            validation={{required: true, min: 0}}
            label={t('forms.distance')}
          />
        </>
      )}
    </FormLayout>
  );
}
