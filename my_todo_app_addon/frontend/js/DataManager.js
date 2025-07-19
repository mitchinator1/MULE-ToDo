import APIManager from "./APIManager.js";

export const DataManager = {
    state: {
        tasks: [],
        currentCategory: { id: null, name: "All" },
        categories: [],
        currentTag: { id: null, name: "All" },
        tags: [],
        currentFilters: {
            status: "active",
            priority: "all",
            dueDate: "all",
        },
        currentSort: "dueDate-asc",
    },

    init: function () {
        this.loadState();
    },

    async loadCategories() {
        try {
            const categories = await APIManager.getCategories();
            this.state.categories = [{ id: null, name: "All" }, ...categories];
        } catch (e) {
            console.error("Failed to load categories:", e);
        }
    },

    async loadTags() {
        try {
            const tags = await APIManager.getTags();
            this.state.tags = [{ id: null, name: "All" }, ...tags];
        } catch (e) {
            console.error("Failed to load tags:", e);
        }
    },

    saveState: function () {
        //localStorage.setItem('taskManagerState', JSON.stringify(this.state));
    },

    loadState: function () {
        const savedState = null; //localStorage.getItem('taskManagerState');

        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                this.state = {
                    ...this.state, // Keep default values as fallback
                    ...parsedState, // Override with saved values
                };
            } catch (error) {
                console.error("Error loading saved state:", error);
            }
        }
    },

    setState: function (newState) {
        this.state = {
            ...this.state,
            ...newState,
        };
        this.saveState(); // Save after state update
    },

    setTasks: function (tasks) {
        this.state.tasks = Array.isArray(tasks) ? tasks : [];
        this.saveState();
    },

    addTask: function (task) {
        this.state.tasks.push(task);
        this.saveState();
    },

    removeTask: function (taskId) {
        const index = this.state.tasks.findIndex((t) => t.id === taskId);
        if (index !== -1) {
            this.state.tasks.splice(index, 1);
        }
    },

    getTaskById(taskId) {
        // Ensure we are comparing numbers to numbers, as taskId from DOM can be a string
        const id = typeof taskId === "string" ? parseInt(taskId, 10) : taskId;
        return this.state.tasks.find((task) => task.id === id);
    },

    getCategoryNameById: function (id) {
        const category = this.state.categories.find((c) => c.id === id);
        return category ? category.name : "Unknown";
    },

    getTagNameById: function (id) {
        const tag = this.state.tags.find((t) => t.id === id);
        return tag ? tag.name : "Unknown";
    },

    updateTask: function (task) {
        const index = this.state.tasks.findIndex((t) => t.id === task.id);

        if (index !== -1) {
            this.state.tasks[index] = task;
            this.saveState();
        }
    },

    deleteTask: function (task) {
        const index = this.state.tasks.findIndex((t) => t.id === task.id);

        if (index !== -1) {
            this.state.tasks.splice(index, 1);
            this.saveState();
        }
    },

    getFilteredAndSortedTasks: function () {
        const tasks = Array.isArray(this.state.tasks) ? this.state.tasks : [];
        let filteredTasks = this.filterTasks(tasks);
        return this.sortTasks(filteredTasks);
    },

    filterTasks: function (tasks) {
        // Add safety check
        if (!Array.isArray(tasks)) {
            console.error("Expected tasks to be an array:", tasks);
            return [];
        }
        return tasks.filter((task) => {
            // Category filter
            if (this.state.currentCategory.name !== "All" && task.categoryId !== this.state.currentCategory.id) {
                return false;
            }
            // Tag filter
            if (this.state.currentTag.name !== "All" && !task.tags?.includes(this.state.currentTag.id)) {
                return false;
            }
            // Status filter
            if (this.state.currentFilters.status !== "all") {
                const isCompleted = task.status === "Completed";
                if (this.state.currentFilters.status === "active" && isCompleted) return false;
                if (this.state.currentFilters.status === "completed" && !isCompleted) return false;
            }
            // Priority filter
            if (this.state.currentFilters.priority !== "all" && task.priority !== this.state.currentFilters.priority) {
                return false;
            }
            // Due date filter
            if (this.state.currentFilters.dueDate !== "all" && task.dueDate) {
                const taskDate = new Date(task.dueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                switch (this.state.currentFilters.dueDate) {
                    case "today":
                        if (taskDate.getTime() !== today.getTime()) return false;
                        break;
                    case "week":
                        const weekFromNow = new Date(today);
                        weekFromNow.setDate(weekFromNow.getDate() + 7);
                        if (taskDate < today || taskDate > weekFromNow) return false;
                        break;
                    case "overdue":
                        if (taskDate >= today) return false;
                        break;
                }
            }
            return true;
        });
    },

    updateFilters: function (filters) {
        this.state.currentFilters = {
            ...this.state.currentFilters,
            ...filters,
        };
        if (filters.sort) {
            this.state.currentSort = filters.sort;
        }
        this.saveState();
    },

    sortTasks: function (tasks) {
        const [field, direction] = this.state.currentSort.split("-");
        return [...tasks].sort((a, b) => {
            let comparison = 0;
            switch (field) {
                case "dueDate":
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate) - new Date(b.dueDate);
                    break;

                case "priority":
                    const priorityOrder = {
                        High: 3,
                        Medium: 2,
                        Low: 1,
                    };
                    comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
                    break;
                case "name":
                    comparison = (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase());
                    break;
                default:
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate) - new Date(b.dueDate);
            }
            return direction === "desc" ? -comparison : comparison;
        });
    },

    setCurrentCategory: function (category) {
        this.state.currentCategory = category;
        this.saveState();
    },

    setCurrentTag: function (tag) {
        this.state.currentTag = tag;
        this.saveState();
    },
};
