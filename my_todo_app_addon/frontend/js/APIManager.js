const INGRESS_PATH_PREFIX = window.location.pathname.replace(/\/$/, "");
const API_BASE_URL = `${INGRESS_PATH_PREFIX}/api`;

const APIManager = {
    // Helper function to handle common fetch logic (error handling, JSON parsing)
    _fetch: async function (url, options = {}) {
        try {
            const response = await fetch(url, options);

            // If the response is not OK (e.g., 404, 500), throw an error
            if (!response.ok) {
                // Try to parse error message from response body if available
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorBody.error || errorBody.message}`);
            }

            // For DELETE requests, the backend might not send a body, so handle accordingly
            if (options && options.method === "DELETE") {
                try {
                    return await response.json();
                } catch {
                    return { message: "Deleted with no response body" };
                }
            }

            // Parse JSON response for other methods
            return await response.json();
        } catch (error) {
            console.error("API call failed:", error);
            // Re-throw to allow calling functions to handle it
            throw error;
        }
    },

    getTasks: async function () {
        return this._fetch(`${API_BASE_URL}/tasks`, {
            method: "GET",
        });
    },

    getTaskHistory: async function (taskId) {
        console.log(`Fetching history for task ${taskId}...`);
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}/history`, {
            method: "GET",
        });
    },

    undoLastChange: async function (taskId) {
        console.log(`Undoing last change for task ${taskId}...`);
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}/undo`, {
            method: "POST",
        });
    },

    redoLastChange: async function (taskId) {
        console.log(`Redoing last change for task ${taskId}...`);
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}/redo`, {
            method: "POST",
        });
    },

    addTask: async function (taskData) {
        return this._fetch(`${API_BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(taskData),
        });
    },

    updateTask: async function (taskId, updates) {
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: "PUT", // Or PATCH, but PUT is fine here for full replacement or partial update
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
        });
    },

    deleteTask: async function (taskId) {
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: "DELETE",
        });
    },

    getCategories: async function () {
        return this._fetch(`${API_BASE_URL}/categories`, {
            method: "GET",
        });
    },

    addCategory: async function (data) {
        return this._fetch(`${API_BASE_URL}/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    },

    updateCategory: async function (id, data) {
        return this._fetch(`${API_BASE_URL}/categories/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    },

    deleteCategory: async function (id) {
        return this._fetch(`${API_BASE_URL}/categories/${id}`, {
            method: "DELETE",
        });
    },

    getTags: async function () {
        return this._fetch(`${API_BASE_URL}/tags`, {
            method: "GET",
        });
    },

    addTag: async function (data) {
        return this._fetch(`${API_BASE_URL}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    },

    updateTag: async function (id, data) {
        return this._fetch(`${API_BASE_URL}/tags/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    },

    deleteTag: async function (id) {
        return this._fetch(`${API_BASE_URL}/tags/${id}`, {
            method: "DELETE",
        });
    },

    elaborateTask: async function (taskId, taskTitle) {
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}/elaborate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: taskTitle }),
        });
    },
};

export default APIManager;
