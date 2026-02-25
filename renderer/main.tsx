import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ModalProvider } from './context/ModalContext';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </StrictMode>
);
