import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createIntl, IntlProvider } from 'react-intl';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/App.css';
import '../../src/event/events.css';
import OptionLabelSelect from '../../src/component/OptionLabelSelect';
import EditableSelectFieldRow from '../../src/component/EditableSelectFieldRow';
import EditablePeriodSelectorField from '../../src/component/EditablePeriodSelectorField';
import { getPeriodLabel, getPeriodOptionLabel, PERIODS, type Period } from '../../src/util/periods';
import messages from '../../src/translations/en.json';

const intl = createIntl({ locale: 'en', messages });
const options = PERIODS.map(period => ({ value: period, label: getPeriodOptionLabel(intl, period), readOnlyLabel: getPeriodLabel(intl, period) }));

function Fixture() {
  const [value, setValue] = useState('INTERWAR');
  const [eventPeriods, setEventPeriods] = useState<Period[]>(['INTERWAR']);
  return <main style={{ padding: '1rem', maxWidth: '36rem' }}>
    <form data-testid="create-period">
      <label htmlFor="fixture-period">Period</label>
      <OptionLabelSelect id="fixture-period" name="period" required defaultValue="" options={[{ value: '', label: 'Choose a period' }, ...options]} />
    </form>
    <div className="mt-4 d-flex align-items-center gap-2" data-testid="metadata-row">
    <div data-testid="inline-period">
      <EditableSelectFieldRow label="Period" editable value={value} options={options} onChange={event => setValue(event.target.value)} />
    </div>
    <span data-testid="adjacent-years" style={{ whiteSpace: 'nowrap' }}>Years</span>
    </div>
    <div data-testid="event-period" className="mt-4">
      <EditablePeriodSelectorField label="Periods" editable value={eventPeriods} onChange={setEventPeriods} onBlur={() => {}} />
    </div>
    <button type="button" className="mt-4">Outside</button>
  </main>;
}

createRoot(document.getElementById('root')!).render(<IntlProvider locale="en" messages={messages}><Fixture /></IntlProvider>);
