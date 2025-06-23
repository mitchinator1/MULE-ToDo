import { TaskManager } from './TaskManager.js';

// Initialize the TaskManager
document.addEventListener('DOMContentLoaded', () => {
    TaskManager.init().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});