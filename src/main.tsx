import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as tf from '@tensorflow/tfjs';

// Initialize TensorFlow.js
tf.ready().then(() => {
  console.log('TensorFlow.js inicializado correctamente');
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}).catch(err => {
  console.error('Error al inicializar TensorFlow.js:', err);
});