import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileCollectionPanel from './ProfileCollectionPanel';

test('filters shared profile sections and keeps thumbnail links', () => {
  render(<MemoryRouter><ProfileCollectionPanel title="Participants" profiles={[
    { id: 'one', firstName: 'Ada', lastName: 'Lovelace', alias: 'ada' },
    { id: 'two', firstName: 'Grace', lastName: 'Hopper', alias: 'grace' },
  ]} filterPlaceholder="Filter participants" emptyText="No participants" /></MemoryRouter>);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter participants' }), { target: { value: 'Grace' } });
  expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Grace Hopper' })).toHaveAttribute('href', '/profile/grace');
});
