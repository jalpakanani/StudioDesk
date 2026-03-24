import { render, screen } from '@testing-library/react';
import App from './App';

test('renders studio title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /my studio desk/i })).toBeInTheDocument();
});
