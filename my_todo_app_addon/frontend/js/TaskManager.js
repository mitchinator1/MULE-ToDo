import { UIManager } from "./UIManager.js";
import { DataManager } from "./DataManager.js";
import APIManager from "./APIManager.js";
import { TaskRenderer } from "./TaskRenderer.js";
import { ModalManager } from "./ModalManager.js";
import FilterManager from "./FilterManager.js";

export const TaskManager = {
    recurringPatterns: {
        daily: {
            days: 1,
        },
        weekday: {
            weekdays: true,
        },
        weekly: {
            weeks: 1,
        },
        biweekly: {
            weeks: 2,
        },
        monthly: {
            months: 1,
        },
        yearly: {
            years: 1,
        },
    },

    async init() {
        try {
            UIManager.init();
            DataManager.init();
            await DataManager.loadCategories();
            UIManager.refreshCategoryDropdown?.();
            UIManager.renderCategories();
            await DataManager.loadTags();
            UIManager.refreshTagDropdown?.();
            UIManager.renderTags();
            this.setupEventListeners();
            UIManager.setupRecurringControls();
            ModalManager.setupRecurringEditControls({
                onRecurringEditSubmit: this.handleRecurringEditSubmit.bind(this),
            });
            ModalManager.setupTagControls();
            UIManager.setupSidebar();
            FilterManager.setupFilters();
            // Only load tasks from server if we don't have any saved
            if (DataManager.getTasks().length === 0) {
                await this.loadTasks();
            } else {
                // Otherwise, just render the saved tasks
                this.renderTasks();
            }
        } catch (error) {
            console.error("Initialization error:", error);
            UIManager.showErrorMessage(error, "initializing application");
        }
    },

    setupEventListeners() {
        UIManager.elements.formElement.addEventListener("submit", async (event) => {
            event.preventDefault();
            const result = await this.handleFormSubmit(event);
            if (result && result.success) {
                // Only reset the form if the submission was successful and it was an add operation
                if (!result.isEditing) {
                    event.target.reset();
                }
            }
        });
        UIManager.elements.addTaskButton.addEventListener("click", () => ModalManager.showTaskForm());
        document.addEventListener("click", (event) => {
            if (event.target === UIManager.elements.taskForm) {
                ModalManager.hideTaskForm();
            }
        });
    },

    async loadTasks() {
        try {
            UIManager.showThrobber("Loading tasks");
            const response = await APIManager.getTasks();
            // Parse the response if it's a string
            const tasks = typeof response === "string" ? JSON.parse(response) : response;
            // Ensure we have an array
            const tasksArray = Array.isArray(tasks) ? tasks : [];
            DataManager.setTasks(tasksArray);
            this.renderTasks();
        } catch (error) {
            UIManager.showErrorMessage(error, "loading tasks");
        } finally {
            UIManager.hideThrobber("Loading tasks");
        }
    },

    renderTasks() {
        UIManager.renderTaskList();
    },

    async handleFormSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const taskId = formData.get("taskId");
        const isEditing = !!taskId; // true if taskId exists, false otherwise

        let result = { success: false };

        try {
            if (isEditing) {
                result = await this.updateTask(taskId, formData);
            } else {
                result = await this.addTask(formData);
            }
        } catch (error) {
            console.error("Error in handleFormSubmit:", error);
            UIManager.showErrorMessage(error, isEditing ? "updating task" : "adding task");
        } finally {
            ModalManager.hideTaskForm();
        }

        return result;
    },

    async addTask(formData) {
        // Get the task name and validate it
        const taskName = formData.get("taskName");
        if (!taskName || taskName.trim() === "") {
            console.error("Task name is required");
            UIManager.showMessage("Task name is required", { type: "error" });
            return;
        }

        const tags = [];
        document.querySelectorAll(".selected-tag-pill").forEach((tag) => {
            const tagId = tag.getAttribute("data-value");
            if (tagId) {
                tags.push(tagId);
            }
        });

        // Prepare taskData with default values for various fields
        const taskData = {
            title: taskName.trim(),
            description: formData.get("description") || "",
            dueDate: formData.get("dueDate") || "",
            priority: formData.get("priority") || "Low",
            categoryId: formData.get("taskCategory") || null,
            tags: tags || null,
            status: "Not Started",
            parentTaskId: formData.get("parentTaskId") || null,
        };

        // Only add recurring data if a pattern is selected
        const pattern = document.getElementById("recurringPattern")?.value;
        if (pattern && pattern !== "none") {
            taskData.recurring = this.getRecurringPattern();
        }

        UIManager.showThrobber("Adding task");

        let result = await APIManager.addTask(taskData);

        if (result.id) {
            // Check for the ID to confirm success for add
            DataManager.addTask(result);
            UIManager.addTaskToUI(result);
            UIManager.showMessage("Task added successfully", "success");
        } else {
            UIManager.showErrorMessage(`Add failed or no task ID returned`, `adding task`);
        }

        UIManager.hideThrobber("Adding task");
        return { success: !!result.id, isEditing: false };
    },

    async updateTask(taskId, formData) {
        const existingTask = DataManager.getTaskById(taskId);

        const tags = [];
        document.querySelectorAll(".selected-tag-pill").forEach((tag) => {
            const tagId = tag.getAttribute("data-value");
            if (tagId) {
                tags.push(tagId);
            }
        });

        const taskData = {
            title: formData.get("taskName").trim(),
            description: formData.get("description") || "",
            dueDate: formData.get("dueDate") || "",
            priority: formData.get("priority") || "Low",
            categoryId: formData.get("taskCategory") || null,
            tags: tags || null,
            status: existingTask.status,
            parentTaskId: formData.get("parentTaskId") || null,
        };

        UIManager.showThrobber("Updating task");

        const changedFields = this.getChangedFields(existingTask, taskData);
        if (Object.keys(changedFields).length === 0) {
            UIManager.showMessage("No changes detected", "info");
            UIManager.hideThrobber("Updating task");
            return { success: true, isEditing: true };
        }

        // Add recurring data to taskData for update
        const pattern = document.getElementById("recurringPattern")?.value;
        if (pattern && pattern !== "none") {
            taskData.recurring = this.getRecurringPattern();
        } else {
            taskData.recurring = {}; // Explicitly set to empty object if no recurring pattern
        }

        // Special handling for recurring: if it changed, ensure it's in changedFields
        // Compare JSON stringified versions for deep equality
        if (JSON.stringify(existingTask.recurring || {}) !== JSON.stringify(taskData.recurring || {})) {
            changedFields.recurring = taskData.recurring;
        }

        try {
            UIManager.showThrobber("Updating task");
            const result = await APIManager.updateTask(taskId, changedFields);
            if (result.message === "Task updated successfully" && result.task) {
                DataManager.updateTask(result.task);
                TaskRenderer.updateTaskElement(taskId, result.task);
                UIManager.showMessage("Task updated successfully", "success");
                return { success: true, isEditing: true };
            } else {
                UIManager.showErrorMessage(`Update failed or no task returned: ${result.message || "Unknown error"}`, `updating task`);
                return { success: false, isEditing: true };
            }
        } catch (err) {
            console.error("Failed to update task", err);
            UIManager.showErrorMessage(err, "updating task");
        } finally {
            UIManager.hideThrobber("Updating task");
        }
    },

    getChangedFields(existingTask, newTaskData) {
        const changedFields = {};
        for (const [key, value] of Object.entries(newTaskData)) {
            if (existingTask[key] !== value) {
                changedFields[key] = value;
            }
        }
        return changedFields;
    },

    async updateTaskStatus(event, taskId, status) {
        try {
            UIManager.showThrobber("Updating status");
            const result = await APIManager.updateTask(taskId, {
                status: status,
            });
            if (result.message === "Task updated successfully" && result.task) {
                DataManager.updateTask(result.task);
                TaskRenderer.updateTaskElement(taskId, result.task);

                // Correctly check if the task is recurring before creating the next instance
                const isRecurring = result.task.recurring && result.task.recurring.frequency && result.task.recurring.frequency !== "none";
                if (status === "Completed" && isRecurring) {
                    await this.handleRecurringTask(result.task);
                }
                UIManager.showMessage("Status updated successfully", "success");
            }
        } catch (error) {
            UIManager.showErrorMessage(error, "updating status");
        } finally {
            UIManager.hideThrobber("Updating status");
        }
    },

    async deleteTask(taskId) {
        try {
            UIManager.showThrobber("Deleting task");
            const result = await APIManager.deleteTask(taskId);
            if (result.message === "Task deleted successfully") {
                DataManager.deleteTask(taskId);
                UIManager.deleteTaskElement(taskId);
                UIManager.showMessage("Task deleted successfully", "success");
            }
        } catch (error) {
            UIManager.showErrorMessage(error, "deleting task");
        } finally {
            UIManager.hideThrobber("Deleting task");
        }
    },

    async handleRecurringTask(task) {
        const nextOccurrence = this.calculateNextOccurrence(task);
        if (nextOccurrence) {
            await this.createNextRecurringTask(task, nextOccurrence);
        }
    },

    calculateNextOccurrence(task) {
        // More robust check for a valid recurring pattern
        if (!task.recurring || !task.recurring.frequency || task.recurring.frequency === "none") {
            return null;
        }

        // Ensure we have a valid date to start from
        const lastDate = new Date(task.dueDate);
        if (isNaN(lastDate.getTime())) {
            console.error("Cannot calculate next occurrence from invalid due date:", task.dueDate);
            return null;
        }
        const pattern = task.recurring;
        let nextDate = new Date(lastDate);

        switch (pattern.frequency) {
            case "daily":
                nextDate.setDate(lastDate.getDate() + 1);
                break;
            case "weekday":
                do {
                    nextDate.setDate(nextDate.getDate() + 1);
                } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
                break;
            case "weekly":
                nextDate.setDate(lastDate.getDate() + 7);
                break;
            case "biweekly":
                nextDate.setDate(lastDate.getDate() + 14);
                break;
            case "monthly":
                nextDate.setMonth(lastDate.getMonth() + 1);
                break;
            case "yearly":
                nextDate.setFullYear(lastDate.getFullYear() + 1);
                break;
            case "custom":
                if (pattern.interval) {
                    const { value, unit } = pattern.interval;
                    switch (unit) {
                        case "days":
                            nextDate.setDate(lastDate.getDate() + value);
                            break;
                        case "weeks":
                            nextDate.setDate(lastDate.getDate() + value * 7);
                            break;
                        case "months":
                            nextDate.setMonth(lastDate.getMonth() + value);
                            break;
                        case "years":
                            nextDate.setFullYear(lastDate.getFullYear() + value);
                            break;
                    }
                }
                break;
        }
        // Check if the recurring series has ended by date
        if (pattern.end && pattern.end.type === "on" && pattern.end.date) {
            if (nextDate > new Date(pattern.end.date)) {
                return null;
            }
        }
        // Note: 'ends after X occurrences' is stateful and best managed by the backend.
        // The client will simply create the next task if the rule hasn't explicitly ended by date.
        return nextDate;
    },

    async createNextRecurringTask(task, nextDate) {
        const { id, ...restOfTask } = task; // Destructure to remove original ID

        const nextTask = {
            ...restOfTask,
            status: "Not Started",
            dueDate: nextDate.toISOString().split("T")[0],
            isRecurringInstance: true,
            originalTaskId: id,
        };
        try {
            const newTask = await APIManager.addTask(nextTask);
            if (newTask && newTask.id) {
                DataManager.addTask(newTask);
                UIManager.addTaskToUI(newTask);
                UIManager.showMessage("Next recurring task created", "success");
            }
        } catch (error) {
            UIManager.showErrorMessage(error, "creating next recurring task");
        }
    },

    async updateTaskField(taskId, field, value) {
        try {
            UIManager.showThrobber(`Updating ${field}`);
            const result = await APIManager.updateTask(taskId, {
                [field]: value, // Dynamically create the updates object, e.g., { title: "new value" }
            });
            if (result.message === "Task updated successfully" && result.task) {
                DataManager.updateTask(result.task);
                TaskRenderer.updateTaskElement(taskId, result.task);
                UIManager.showMessage("Task updated successfully", "success");
            } else {
                UIManager.showErrorMessage(`Failed to update ${field}`, `updating ${field}`);
                // Revert UI changes here if needed
            }
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            UIManager.showErrorMessage(error, `updating ${field}`);
            // Revert UI changes here if needed
        } finally {
            UIManager.hideThrobber(`Updating ${field}`);
        }
    },

    updateTitle(event, taskId) {
        const newTitle = event.target.value.trim();
        if (newTitle) {
            const container = event.target.closest(".title-container");
            const titleSpan = container.querySelector(".task-title");
            if (newTitle !== titleSpan.textContent) {
                titleSpan.textContent = newTitle; // Update UI immediately
                this.updateTaskField(taskId, "title", newTitle);
            }
        }
        TaskRenderer.finishTitleEdit(event.target.closest(".title-container"));
    },

    updateDescription(event, taskId) {
        const newDescription = event.target.value.trim();
        const container = event.target.closest(".description-container");

        // Get the original description from the data model, not the DOM, to correctly handle placeholders.
        const task = DataManager.getTaskById(taskId);
        const oldDescription = task ? task.description : "";

        // Only update if the content has actually changed.
        if (newDescription !== oldDescription) {
            const descriptionDiv = container.querySelector(".description");
            descriptionDiv.innerHTML = newDescription || '<span class="placeholder">Add description...</span>';
            this.updateTaskField(taskId, "description", newDescription);
        }
        TaskRenderer.finishDescriptionEdit(container);
    },

    updateDueDate(event, taskId) {
        event.stopPropagation();
        const newDueDate = event.target.value;
        console.log("Updating due date for task:", taskId, "to", newDueDate);
        TaskRenderer.updateDueDateDisplay(taskId, newDueDate);
        this.updateTaskField(taskId, "dueDate", newDueDate);
    },

    updatePriority(event, taskId, priority) {
        event.stopPropagation(); // Prevent the event from bubbling up
        TaskRenderer.updatePriorityDisplay(taskId, priority);
        this.updateTaskField(taskId, "priority", priority);
    },

    async handleRecurringEditSubmit(e) {
        e.preventDefault();
        const taskId = e.target.elements.editRecurringTaskId.value;

        const recurring = this.getRecurringPattern("edit"); // already returns structured format
        if (!recurring || recurring.pattern === "none") {
            // If pattern is none, remove recurring rule
            recurring.frequency = "";
        }

        try {
            UIManager.showThrobber("Updating recurring pattern");

            const result = await APIManager.updateTask(taskId, {
                recurring, // send as object (NOT string)
            });

            console.log(result);

            if (result.message === "Task updated successfully" && result.task) {
                DataManager.updateTask(result.task);
                UIManager.updateTaskElement(taskId, result.task);
            }
        } catch (error) {
            UIManager.showErrorMessage(error, "updating recurring pattern");
        } finally {
            UIManager.hideThrobber("Updating recurring pattern");
            ModalManager.hideRecurringEditForm();
        }
    },

    getRecurringPattern(prefix = "") {
        const form = prefix ? document.getElementById("recurringEditForm") : document.getElementById("taskFormElement");

        const patternId = prefix ? `${prefix}RecurringPattern` : "recurringPattern";
        const customIntervalId = prefix ? `${prefix}CustomInterval` : "customInterval";
        const customUnitId = prefix ? `${prefix}CustomUnit` : "customUnit";
        const recurringEndName = prefix ? `${prefix}RecurringEnd` : "recurringEnd";
        const occurenceCountId = prefix ? `${prefix}OccurenceCount` : "occurenceCount";
        const endDateId = prefix ? `${prefix}EndDate` : "endDate";
        const byMonthDayId = prefix ? `${prefix}ByMonthDay` : "editByMonthDay";

        const frequency = form.querySelector(`#${patternId}`)?.value || "none";

        if (frequency === "none") return {};

        const recurringData = {
            frequency,
            interval: null,
            by_day: null,
            by_month_day: null,
            end: {
                date: null,
                type: form.querySelector(`input[name="${recurringEndName}"]:checked`)?.value || "never",
                after_occurrences: parseInt(form.querySelector(`#${occurenceCountId}`)?.value) || null,
            },
        };

        // Handle custom frequency interval
        if (frequency === "custom") {
            const val = parseInt(form.querySelector(`#${customIntervalId}`)?.value || "1");
            const unit = form.querySelector(`#${customUnitId}`)?.value || "days";
            recurringData.interval = { value: val, unit };
        }

        // Handle weekly/weekday frequency (checkboxes)
        if (frequency === "weekly" || frequency === "weekday") {
            const checked = Array.from(form.querySelectorAll(".weekday-checkbox"))
                .filter((cb) => cb.checked)
                .map((cb) => cb.value);
            if (checked.length) {
                recurringData.by_day = checked.join(",");
            }
        }

        // Handle monthly frequency (by_month_day)
        if (frequency === "monthly") {
            const byMonthDay = form.querySelector(`#${byMonthDayId}`)?.value;
            if (byMonthDay) {
                recurringData.by_month_day = byMonthDay;
            }
        }

        // Handle end type
        if (recurringData.end.type === "after") {
            const occurenceCount = form.querySelector(`#${occurenceCountId}`);
            recurringData.end.after_occurrences = occurenceCount ? parseInt(occurenceCount.value) : 1;
        } else if (recurringData.end.type === "on") {
            const endDate = form.querySelector(`#${endDateId}`);
            recurringData.end.date = endDate ? endDate.value : null;
        }

        const dueDateInput = form.querySelector(prefix ? `#${prefix}DueDate` : "#dueDate");
        recurringData.start_date = dueDateInput?.value || new Date().toISOString().split("T")[0];

        return recurringData;
    },

    selectCategory(category) {
        DataManager.setCurrentCategory(category);
        this.renderTasks();
        UIManager.updateCategorySelection(category);
    },

    selectTag(tag) {
        DataManager.setCurrentTag(tag);
        this.renderTasks();
        UIManager.updateTagSelection(tag);
    },

    async elaborateTaskWithAI(taskId) {
        const task = DataManager.getTaskById(taskId);
        if (!task) {
            UIManager.showErrorMessage("Task not found", "elaborating task");
            return;
        }

        UIManager.showThrobber("Elaborating task with AI");

        try {
            const { subtasks } = await APIManager.elaborateTask(taskId, task.title, task.description);

            if (!Array.isArray(subtasks)) {
                throw new Error("Invalid subtasks format");
            }

            console.log("Subtasks from AI:", subtasks);

            subtasks.forEach(async (subtask) => {
                let result = await APIManager.addTask({
                    title: subtask.title,
                    description: subtask.description || "",
                    dueDate: "",
                    priority: "Low",
                    categoryId: null,
                    tags: [],
                    status: "Not Started",
                    parentTaskId: taskId,
                });

                if (result.id) {
                    DataManager.addTask(result);
                    UIManager.addTaskToUI(result);
                } else {
                    UIManager.showErrorMessage(`Add failed or no task ID returned`, `adding task`);
                }
            });
            UIManager.showMessage(`Task elaborated with AI successfully`, "success");
        } catch (error) {
            UIManager.showErrorMessage(error.message, "elaborating task");
        } finally {
            UIManager.hideThrobber("Elaborating task with AI");
        }
    },
};
