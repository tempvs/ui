import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import StackedImageGallery from './StackedImageGallery';

const images = [
  {
    id: 'image-1',
    url: 'https://example.test/one.jpg',
    fileName: 'One',
    description: 'Front view of the source',
  },
  { id: 'image-2', url: 'https://example.test/two.jpg', fileName: 'Two' },
];

test('renders a simple modal without carousel controls in single-image mode', () => {
  render(
    <StackedImageGallery images={images} mode="single" title="Profile picture" />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'One' }));

  expect(screen.getByText('Profile picture')).toBeInTheDocument();
  expect(document.querySelector('.carousel')).not.toBeInTheDocument();
  expect(document.querySelector('.carousel-control-next')).not.toBeInTheDocument();
  expect(screen.getByText('Front view of the source')).toBeInTheDocument();
  expect(document.querySelector('.modal .border-top')).toBeInTheDocument();
});

test('renders carousel controls in multiple-image mode', () => {
  render(
    <StackedImageGallery images={images} mode="multiple" title="Source images" />,
  );

  fireEvent.click(screen.getByRole('button', { name: /2 image/ }));

  expect(screen.getByText('Source images')).toBeInTheDocument();
  expect(document.querySelector('.carousel')).toBeInTheDocument();
  expect(document.querySelector('.carousel-control-next')).toBeInTheDocument();
  expect(screen.getByText('Front view of the source')).toBeInTheDocument();
  expect(document.querySelector('.carousel .border-top')).not.toBeInTheDocument();
  expect(document.querySelector('.stacked-image-gallery-modal-image-frame')).toBeInTheDocument();
  expect(document.querySelector('.modal .border-top')).toBeInTheDocument();
});

test('renders photo controls for the active album image', () => {
  const setCover = jest.fn();
  render(
    <StackedImageGallery
      images={images}
      renderImageControls={(photo) => (
        <button onClick={() => setCover(photo.id)}>Set as cover</button>
      )}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /2 image/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Set as cover' }));
  expect(setCover).toHaveBeenCalledWith('image-2');
  expect(screen.getByRole('button', { name: /2 image/ })).toBeInTheDocument();
});

test('removes a deleted carousel image immediately without waiting for a parent refresh', () => {
  const remove = jest.fn();
  render(
    <StackedImageGallery
      images={images}
      mode="multiple"
      title="Item images"
      editable
      onDeleteImage={remove}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /2 image/ }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(remove).toHaveBeenCalledWith('image-1');
  expect(screen.queryByAltText('One')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /1 image/ })).toBeInTheDocument();
});

test('reserves room for no more than three stacked preview images', () => {
  render(
    <StackedImageGallery
      images={[
        ...images,
        { id: 'image-3', url: 'https://example.test/three.jpg', fileName: 'Three' },
        { id: 'image-4', url: 'https://example.test/four.jpg', fileName: 'Four' },
      ]}
      mode="multiple"
      title="Album images"
    />,
  );

  expect(document.querySelectorAll('.stacked-image-gallery-preview-image')).toHaveLength(3);
  expect(screen.getByRole('button', { name: /4 image/ })).toBeInTheDocument();
});

test('renders the shared hourglass placeholder when no images exist', () => {
  render(<StackedImageGallery images={[]} emptyText="No source images" />);

  expect(screen.getByRole('img', { name: 'No source images' })).toHaveAttribute('src', 'default-image.png');
});

test('single-image upload becomes replace and returns after deleting the photo', () => {
  const upload = jest.fn();
  const replace = jest.fn();
  const remove = jest.fn();
  const props = { editable: true, onUploadImage: upload, onReplaceImage: replace, onDeleteImage: remove };
  const view = render(<StackedImageGallery {...props} mode="single" images={[]} />);

  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  expect(upload).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Replace image' })).not.toBeInTheDocument();

  view.rerender(<StackedImageGallery {...props} mode="single" images={images} />);
  expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Replace image' }));
  expect(replace).toHaveBeenCalledWith(images[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Delete image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('image-1');
  expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
});

test.each([{ photos: [], state: 'empty' }, { photos: images, state: 'populated' }])('multiple-image galleries can add photos when $state', ({ photos }) => {
  const add = jest.fn();
  render(<StackedImageGallery mode="multiple" images={photos} editable onAddImage={add} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add image' }));
  expect(add).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each(['single', 'multiple'] as const)('read-only %s galleries hide all image actions even when handlers are supplied', (mode) => {
  const props = { mode, editable: false, canAddImage: true, onUploadImage: jest.fn(), onAddImage: jest.fn(), onReplaceImage: jest.fn(), onDeleteImage: jest.fn() };
  const view = render(<StackedImageGallery {...props} images={[]} />);
  expect(screen.queryByRole('button', { name: /Upload image|Add image/ })).not.toBeInTheDocument();

  view.rerender(<StackedImageGallery {...props} images={images} />);
  expect(screen.queryByRole('button', { name: /Upload image|Add image|Replace image|Delete image/ })).not.toBeInTheDocument();
});

test.each(['single', 'multiple'] as const)('%s gallery actions remain visible and disabled while busy', (mode) => {
  const action = jest.fn();
  const props = { mode, editable: true, disabled: true, onUploadImage: action, onAddImage: action, onReplaceImage: action, onDeleteImage: action };
  const view = render(<StackedImageGallery {...props} images={[]} />);
  const button = screen.getByRole('button', { name: mode === 'single' ? 'Upload image' : 'Add image' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();

  view.rerender(<StackedImageGallery {...props} images={images} />);
  if (mode === 'multiple') {
    expect(screen.getByRole('button', { name: 'Add image' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /2 image/ }));
  }
  expect(screen.getAllByRole('button', { name: 'Replace image' })[0]).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'Delete image' })[0]).toBeDisabled();
});

test('a multiple-image gallery can explicitly prevent additional uploads', () => {
  render(<StackedImageGallery images={images} editable canAddImage={false} onAddImage={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Add image' })).not.toBeInTheDocument();
});

test('uses the shared click-to-edit description field below a compact image and in its preview', () => {
  const changeDescription = jest.fn();
  const saveDescription = jest.fn();
  render(
    <StackedImageGallery
      images={images}
      mode="single"
      title="Source image"
      editable
      showInlineDescription
      imageDrafts={{ 'image-1': 'Draft source description' }}
      onDescriptionChange={changeDescription}
      onDescriptionBlur={saveDescription}
    />,
  );

  const compactDescription = screen.getByDisplayValue('Draft source description');
  expect(compactDescription).toHaveAttribute('readonly');
  fireEvent.click(compactDescription);
  expect(compactDescription).not.toHaveAttribute('readonly');
  fireEvent.change(compactDescription, { target: { value: 'Updated description' } });
  fireEvent.blur(compactDescription);
  expect(changeDescription).toHaveBeenCalledWith('image-1', 'Updated description');
  expect(saveDescription).toHaveBeenCalledWith('image-1');

  fireEvent.click(screen.getByRole('button', { name: 'One' }));
  expect(screen.getAllByDisplayValue('Draft source description')).toHaveLength(2);
});
