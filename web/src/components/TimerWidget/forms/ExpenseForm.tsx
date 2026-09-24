/**
 * ExpenseForm - Add expense to current task
 * Adapted from browser-extensions ExpenseForm component
 */

import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import {format} from 'date-fns';
import {useData} from '../DataProvider';
import {useViewRouter} from '../ViewRouter';
import {useTaskOperations} from '../../../utils/timesheet-hooks';
import Input from '../../shared/Input';
import Textarea from '../../shared/Textarea';
import Switch from '../../shared/Switch';
import Spinner from '../../shared/Spinner';
import FormLayout from './FormLayout';
import {useTranslation} from 'react-i18next';
import {toOffsetISOString} from '../../../format';

export default function ExpenseForm(): JSX.Element {
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

      await taskOps.addExpense({
        description: formValues.description,
        // The tool takes the amount as a decimal string
        amount: String(parseFloat(formValues.amount)),
        refunded: !!formValues.refunded,
        dateTime: toOffsetISOString(dateTime),
      });
    } catch (err) {
      // The form stays as it is, with what the user typed
      console.error('Failed to add expense:', err);
      setError(t('forms.saveFailed.expense'));
      setSaving(false);
      return;
    }

    // The expense is saved: a timer that could not be reloaded only shows older numbers
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
      submitLabel={t('forms.submit.expense')}
      savingLabel={t('forms.saving.expense')}
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
      <Input
        id="amount"
        type="number"
        step="any"
        validation={{required: true, min: 0}}
        prepend={<span className="text-secondary sm:text-sm">{settings.currency}</span>}
        className="text-sm"
        wrapperClasses="col-span-2"
        defaultValue={0}
        label={t('forms.amount')}
      />
      <Textarea
        id="description"
        wrapperClasses="col-span-2"
        label={t('forms.description')}
        rows={4}
      />
      <Switch
        id="refunded"
        wrapperClasses="col-span-2"
        label={t('forms.refunded')}
      />
    </FormLayout>
  );
}
