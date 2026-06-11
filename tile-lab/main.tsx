import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TileLabApp } from './TileLabApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TileLabApp />
  </StrictMode>,
);
