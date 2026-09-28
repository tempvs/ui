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
  expect(document.querySelector('.carousel .border-top')).toBeInTheDocument();
});
