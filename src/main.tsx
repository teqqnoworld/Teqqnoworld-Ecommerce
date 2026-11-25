import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ReviewSummaryProvider} from './context/ReviewSummaryContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ReviewSummaryProvider>
    <App />
  </ReviewSummaryProvider>
);
