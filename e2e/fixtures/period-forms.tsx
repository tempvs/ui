import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createIntl } from 'react-intl';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/App.css';
import OptionLabelSelect from '../../src/component/OptionLabelSelect';
import EditableSelectFieldRow from '../../src/component/EditableSelectFieldRow';
import { getPeriodLabel, getPeriodOptionLabel, PERIODS } from '../../src/util/periods';
import messages from '../../src/translations/en.json';

const intl = createIntl({ locale: 'en', messages });
const options = PERIODS.map(period => ({ value: period, label: getPeriodOptionLabel(intl, period), readOnlyLabel: getPeriodLabel(intl, period) }));

function Fixture() {
  const [value, setValue] = useState('INTERWAR');
  return <main style={{ padding: '1rem', maxWidth: '36rem' }}>
    <form data-testid="create-period">
      <label htmlFor="fixture-period">Period</label>
      <OptionLabelSelect id="fixture-period" name="period" required defaultValue="" options={[{ value: '', label: 'Choose a period' }, ...options]} />
    </form>
    <div data-testid="inline-period" className="mt-4">
      <EditableSelectFieldRow label="Period" editable value={value} options={options} onChange={event => setValue(event.target.value)} />
    </div>
    <button type="button" className="mt-4">Outside</button>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
