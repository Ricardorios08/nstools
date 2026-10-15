const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 3000;

// Detect if we are in development using Vite's built-in env variable
const isDevelopment = import.meta.env.DEV;

const API_BASE_URL = isDevelopment
    ? `http://${window.location.hostname}:${BACKEND_PORT}`
    : ''; // In production, we use relative paths

export const API_URL = `${API_BASE_URL}/api`;

export default API_BASE_URL;
