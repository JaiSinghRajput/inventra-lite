/// <reference types="vite/client" />
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import '../styles/app.css';

hydrateRoot(document, <StartClient />);
