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
