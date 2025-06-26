/**
 * SVGIcons.js
 *
 * Centralized definitions for SVG icon paths and a helper function
 * to generate full SVG strings. This promotes reusability and consistency.
 */

export const SVG_PATHS = {
    // Add Subtask (parent task with line to subtask)
    'add-subtask': {
        viewBox: '0 0 24 24',
        path: '<rect x="3" y="4" width="18" height="6" rx="1"></rect><rect x="9" y="14" width="12" height="6" rx="1"></rect><path d="M6 10v6h3"></path>'
    },
    // Delete (trash can)
    'delete': {
        viewBox: '0 0 24 24',
        path: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>'
    },
    // Recurring (loop arrows)
    'recurring': {
        viewBox: '0 0 24 24',
        path: '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>'
    },
    // Edit (pencil)
    'edit': {
        viewBox: '0 0 24 24',
        path: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'
    },
    // Details (chevron right)
    'details': {
        viewBox: '0 0 24 24',
        path: '<polyline points="9 18 15 12 9 6"></polyline>'
    },
    // Separator (vertical line)
    'separator': {
        viewBox: '0 0 24 24',
        path: '<line x1="12" y1="0" x2="12" y2="24"></line>'
    },
    // Save (floppy disk)
    'save': {
        viewBox: '0 0 24 24',
        path: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>'
    }
};

/**
 * Generates a full SVG string from predefined path data.
 * @param {string} iconKey - The key of the icon in SVG_PATHS (e.g., 'delete', 'save').
 * @param {number} width - The desired width of the SVG.
 * @param {number} height - The desired height of the SVG.
 * @param {string} [className=''] - Optional CSS class names for the SVG.
 * @returns {string} The complete SVG string.
 */
export function createSVG(iconKey, width, height, className = '') {
    const icon = SVG_PATHS[iconKey];
    if (!icon) {
        console.warn(`SVG icon '${iconKey}' not found.`);
        return '';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${icon.viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}">${icon.path}</svg>`;
}