import { fireEvent, render, screen } from '@testing-library/react';

import ProfileRelationshipPanel from './ProfileRelationshipPanel';

test('renders the shared relationship heading and filters its items', () => {
  render(<ProfileRelationshipPanel
    title="Events"
    items={[{ name: 'Autumn Fair' }, { name: 'Winter Market' }]}
    loaded
    filterPlaceholder="Filter followed events"
    getSearchText={item => item.name}
    renderItems={items => <ul>{items.map(item => <li key={item.name}>{item.name}</li>)}</ul>}
    emptyText="No followed events yet."
    noMatchesText="No followed events match this filter."
  />);

  const section = screen.getByRole('region', { name: 'Events' });
  expect(section).toHaveClass('profile-relationship-panel');
  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter followed events' }), { target: { value: 'winter' } });
  expect(screen.getByText('Winter Market')).toBeInTheDocument();
  expect(screen.queryByText('Autumn Fair')).not.toBeInTheDocument();
});
