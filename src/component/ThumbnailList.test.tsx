import { fireEvent, render, screen } from '@testing-library/react';
import ThumbnailList, { ThumbnailListViewport } from './ThumbnailList';

const items = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `Entry ${index}` }));
const renderList = (values: typeof items) => <ThumbnailList items={values} getKey={item => item.id} renderItem={item => <span>{item.name}</span>} />;

function sizeViewport(element: Element, scrollTop: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 192 },
    scrollHeight: { configurable: true, get: () => element.querySelectorAll('.thumbnail-list-row').length * 64 },
    scrollTop: { configurable: true, writable: true, value: scrollTop },
  });
}

test('mounts pages ahead of scrolling and uses one viewport for nested lists', () => {
  const view = render(<ThumbnailListViewport items={items} label="Entries" renderItems={renderList} />);
  expect(view.container.querySelectorAll('.thumbnail-list-viewport')).toHaveLength(1);
  expect(screen.getAllByRole('listitem')).toHaveLength(9);
  const viewport = screen.getByRole('region', { name: 'Entries' });
  sizeViewport(viewport, 0);
  fireEvent.scroll(viewport);
  expect(screen.getAllByRole('listitem')).toHaveLength(9);
  // There are still two rows below the viewport when the next page is mounted.
  sizeViewport(viewport, 256);
  fireEvent.scroll(viewport);
  expect(screen.getByText('Entry 9')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(18);
  expect(screen.getByText('Entry 0')).toBeInTheDocument();
  expect(viewport.scrollTop).toBe(256);
});

test('requests a server page before reaching the bottom, and pauses during a request', () => {
  const load = jest.fn();
  const view = render(<ThumbnailListViewport items={items.slice(0, 9)} label="Entries" onReachEnd={load} renderItems={renderList} />);
  const viewport = screen.getByRole('region', { name: 'Entries' });
  sizeViewport(viewport, 256);
  fireEvent.scroll(viewport);
  expect(load).toHaveBeenCalledTimes(1);
  view.rerender(<ThumbnailListViewport items={items.slice(0, 9)} label="Entries" loading onReachEnd={load} renderItems={renderList} />);
  fireEvent.scroll(viewport);
  expect(load).toHaveBeenCalledTimes(1);
});
