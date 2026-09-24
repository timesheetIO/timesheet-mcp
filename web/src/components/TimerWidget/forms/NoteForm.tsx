/**
 * NoteForm - Add note to current task
 * Adapted from browser-extensions NoteForm component
 */

import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import {format} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTaskOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Textarea from '../../shared/Textarea';
import Spinner from '../../shared/Spinner';
import FormLayout from './FormLayout';
import {useTranslation} from 'react-i18next';
import {toOffsetISOString} from '../../../format';

export default function NoteForm(): JSX.Element {
  const {t} = useTranslation();
  const formMethods = useForm();
  const {timer, settings, reloadTimer} = useData();
  const {goBack} = useViewRouter();
  const taskOps = useTaskOperations();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (formValues: any) => {
    setError(null);
    setSaving(true);

    try {
      // Combine date and time into ISO string
      const dateTime = new Date(`${formValues.date}T${formValues.time}`);
      dateTime.setSeconds(0, 0);

      await taskOps.addNote({
        text: formValues.description,
        dateTime: toOffsetISOString(dateTime),
      });
    } catch (err) {
      // The form stays as it is, with the note the user typed
      console.error('Failed to add note:', err);
      setError(t('forms.saveFailed.note'));
      setSaving(false);
      return;
    }

    // The note is saved: a timer that could not be reloaded only shows older numbers
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
      submitLabel={t('forms.submit.note')}
      savingLabel={t('forms.saving.note')}
    >
      <Input
        id="date"
        type="date"
        validation={{required: true}}
        defaultValue={format(new Date(), 'yyyy-MM-dd')}
        min={format(new Date(timer?.task.startDateTime || 0), 'yyyy-MM-dd')}
        className="text-sm"
        label={t('forms.date')}
      />
      <Input
        id="time"
        type="time"
        validation={{required: true}}
        className="text-sm"
        defaultValue={format(new Date(), 'HH:mm')}
        label={t('forms.time')}
      />
      <Textarea
        id="description"
        wrapperClasses="col-span-2"
        validation={{
          required: t('forms.descriptionRequired'),
        }}
        label={t('forms.description')}
        rows={4}
      />
    </FormLayout>
  );
}
