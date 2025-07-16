import { DataManager } from "./DataManager.js";
import { TaskManager } from "./TaskManager.js";
import { ModalManager } from "./ModalManager.js";
import { createSVG } from "./SVGIcons.js";

// This object is responsible for creating, updating, and managing interactions
// for individual task elements in the DOM.
export const TaskRenderer = {
    UIManager: null,

    setUIManager(manager) {
        this.UIManager = manager;
    },

    createTaskElement: function (task) {
        const recurringData = typeof task.recurring === "object" ? task.recurring : typeof task.recurring === "string" ? JSON.parse(task.recurring || "{}") : {};

        console.log("Creating task element for:", task.id, "with data:", task);

        const taskData = {
            id: task.id,
            title: task.title || "Untitled Task",
            description: task.description || "",
            dueDate: task.dueDate || "",
            status: task.status || "Not Started",
            priority: task.priority || "Medium",
            categoryId: task.categoryId || null,
            recurring: recurringData,
        };

        const taskItem = document.createElement("div");
        taskItem.className = "task-item";
        taskItem.dataset.taskId = taskData.id;
        // Apply 'completed' class if task is completed
        if (taskData.status === "Completed") {
            taskItem.classList.add("completed");
        }

        // --- 1. Task Summary (Always Visible) ---
        const summary = document.createElement("div");
        summary.className = "task-summary";

        // Checkbox for completion
        const checkboxContainer = document.createElement("div");
        checkboxContainer.className = "task-checkbox-container";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = taskData.status === "Completed";
        checkbox.addEventListener("change", (e) => {
            TaskManager.updateTaskStatus(e, taskData.id, e.target.checked ? "Completed" : "Not Started");
        });
        checkboxContainer.appendChild(checkbox);
        summary.appendChild(checkboxContainer);

        const titleContainer = document.createElement("div");
        titleContainer.className = "title-container";
        const titleSpan = document.createElement("span");
        titleSpan.className = "task-title";
        titleSpan.textContent = taskData.title;
        titleSpan.addEventListener("click", (e) => this.editTaskTitle(e, taskData.id));
        titleContainer.appendChild(titleSpan);
        const titleInput = document.createElement("input");
        titleInput.className = "title-edit";
        titleInput.style.display = "none";
        titleInput.value = taskData.title;
        titleInput.addEventListener("blur", (e) => TaskManager.updateTitle(e, taskData.id));
        titleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") e.target.blur();
            if (e.key === "Escape") this.finishTitleEdit(titleContainer);
        });
        titleContainer.appendChild(titleInput);
        summary.appendChild(titleContainer);

        const summaryMeta = document.createElement("div");
        summaryMeta.className = "task-summary-meta";

        // Recurring icon (if applicable)
        if (taskData.recurring && Object.keys(taskData.recurring).length > 0) {
            const recurringIndicator = document.createElement("span");
            recurringIndicator.className = "recurring-indicator recurring-svg";
            recurringIndicator.innerHTML = createSVG("recurring", 18, 18, "recurring-svg");
            recurringIndicator.title = this.UIManager.getRecurringDescription(taskData.recurring);
            recurringIndicator.dataset.recurring = JSON.stringify(taskData.recurring); // Store raw data for modal
            recurringIndicator.addEventListener("click", (e) => ModalManager.showRecurringEditForm(taskData.id, e));
            summaryMeta.appendChild(recurringIndicator);
        }

        // Due Date
        const dueDateDisplay = document.createElement("div");
        dueDateDisplay.className = "due-date-display";
        dueDateDisplay.dataset.rawDate = taskData.dueDate || ""; // Store raw date for date input
        dueDateDisplay.textContent = taskData.dueDate ? "Due: " + this.UIManager.formatDateForDisplay(taskData.dueDate) : "No Due Date";
        dueDateDisplay.addEventListener("click", (e) => this.UIManager.toggleUniversalDueDateDropdown(e.currentTarget, taskData.id));
        summaryMeta.appendChild(dueDateDisplay);

        // Priority
        const priorityDisplay = document.createElement("div");
        priorityDisplay.className = `priority priority-${taskData.priority}`; // e.g., priority-High
        priorityDisplay.textContent = taskData.priority;
        priorityDisplay.addEventListener("click", (e) => this.UIManager.toggleUniversalPriorityDropdown(e.currentTarget, taskData.id));
        summaryMeta.appendChild(priorityDisplay);

        summary.appendChild(summaryMeta);
        taskItem.appendChild(summary);

        // --- 2. Task Details (Collapsible) ---
        const detailsCollapsible = document.createElement("div");
        detailsCollapsible.className = "task-details-collapsible";

        // Description
        const descContainer = document.createElement("div");
        descContainer.className = "description-container";
        const desc = document.createElement("div");
        desc.className = "description";
        desc.innerHTML = taskData.description || '<span class="placeholder">Add description...</span>';
        desc.addEventListener("click", (e) => this.editTaskDescription(e, taskData.id));
        descContainer.appendChild(desc);
        const descEdit = document.createElement("textarea");
        descEdit.className = "description-edit";
        descEdit.style.display = "none";
        descEdit.value = taskData.description;
        descEdit.addEventListener("blur", (e) => TaskManager.updateDescription(e, taskData.id));
        descEdit.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.finishDescriptionEdit(descContainer);
        });
        descContainer.appendChild(descEdit);
        detailsCollapsible.appendChild(descContainer);

        // Extended Meta Section
        const extendedMeta = document.createElement("div");
        extendedMeta.className = "task-meta-extended";
        extendedMeta.innerHTML = `
			<div class="meta-row"><span class="meta-label">Category:</span> <span class="meta-value">${DataManager.state.categories.find((c) => c.id === taskData.categoryId)?.name || "None"}</span></div>
			<div class="meta-row"><span class="meta-label">Tags:</span> <span class="meta-value">${task.tags?.length ? task.tags.map((tag) => DataManager.getTagNameById(tag)).join(", ") : "None"}</span></div>
			<div class="meta-row"><span class="meta-label">Status:</span> <span class="meta-value status">${taskData.status}</span></div>
		`;
        detailsCollapsible.appendChild(extendedMeta);

        // Subtask Expander
        const expand = document.createElement("div");
        expand.className = `task-expand-indicator ${task.hasSubtasks ? "" : "hidden"}`;
        expand.innerHTML = "<span>Subtasks</span>";
        expand.addEventListener("click", (e) => this.UIManager.toggleSubtasks(taskData.id, e));
        detailsCollapsible.appendChild(expand);

        taskItem.appendChild(detailsCollapsible);

        // --- 3. Task Actions Footer ---
        const actionsFooter = document.createElement("div");
        actionsFooter.className = "task-actions-footer";

        // Details Toggle Button
        const detailsToggleBtn = document.createElement("button");
        detailsToggleBtn.className = "details-toggle-btn";
        detailsToggleBtn.innerHTML = createSVG("details", 18, 18, "details-arrow-svg") + "<span>Details</span>";
        actionsFooter.appendChild(detailsToggleBtn);

        const seperator = document.createElement("span");
        seperator.className = "seperator";
        seperator.innerHTML = createSVG("separator", 22, 22, "separator-svg");
        actionsFooter.appendChild(seperator);

        // "Add Subtask" button
        const addBtn = document.createElement("button");
        addBtn.className = "btn";
        addBtn.title = "Add Subtask";
        addBtn.innerHTML = createSVG("add-subtask", 20, 20, "add-subtask-svg");
        addBtn.addEventListener("click", () => ModalManager.showTaskForm(null, taskData.id));
        actionsFooter.appendChild(addBtn);

        // "Delete" button
        const delBtn = document.createElement("button");
        delBtn.className = "btn";
        delBtn.title = "Delete Task";
        delBtn.innerHTML = createSVG("delete", 20, 20, "delete-svg");
        delBtn.addEventListener("click", () => TaskManager.deleteTask(taskData.id));
        actionsFooter.appendChild(delBtn);

        // Edit button
        const editBtn = document.createElement("button");
        editBtn.className = "btn edit-button";
        editBtn.title = "Edit Task";
        editBtn.innerHTML = createSVG("edit", 18, 18, "feather feather-edit");
        editBtn.addEventListener("click", () => ModalManager.showTaskForm(taskData.id));
        actionsFooter.appendChild(editBtn);

        taskItem.appendChild(actionsFooter);

        // Event listener for the new toggle
        detailsToggleBtn.addEventListener("click", (e) => {
            const isCollapsing = detailsCollapsible.classList.contains("expanded");
            const detailsText = detailsToggleBtn.querySelector("span");

            if (isCollapsing) {
                detailsCollapsible.style.maxHeight = detailsCollapsible.scrollHeight + "px";
                detailsCollapsible.offsetHeight;

                detailsCollapsible.classList.remove("expanded");
                detailsToggleBtn.classList.remove("expanded");
                if (detailsText) detailsText.textContent = "Details";
                detailsCollapsible.style.maxHeight = "0px";
            } else {
                detailsCollapsible.classList.add("expanded");
                detailsToggleBtn.classList.add("expanded");
                if (detailsText) detailsText.textContent = "Hide";
                detailsCollapsible.style.maxHeight = detailsCollapsible.scrollHeight + "px";
            }
            setTimeout(() => this.UIManager.updateParentContainers(detailsCollapsible), 0);
        });

        return taskItem;
    },

    updateTaskElement: function (taskId, updatedTask) {
        const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Update title
        const titleSpan = taskElement.querySelector(".task-title");
        const titleInput = taskElement.querySelector(".title-edit");
        if (titleSpan) {
            titleSpan.textContent = updatedTask.title || "Untitled Task";
            titleSpan.style.visibility = "visible";
            if (titleInput) {
                titleInput.value = updatedTask.title || "Untitled Task";
                titleInput.style.display = "none";
            }
        }
        // Update description
        const descriptionDiv = taskElement.querySelector(".description");
        const descriptionTextarea = taskElement.querySelector(".description-edit");
        if (descriptionDiv) {
            const description = updatedTask.description || "";
            descriptionDiv.innerHTML = description || '<span class="placeholder">Add description...</span>';
            descriptionDiv.style.visibility = "visible";
            if (descriptionTextarea) {
                descriptionTextarea.value = description;
                descriptionTextarea.style.display = "none";
            }
        }
        // Update status
        const statusElement = taskElement.querySelector(".status");
        if (statusElement) {
            statusElement.textContent = updatedTask.status || "Not Started";
        }

        // Update completed status
        const taskItemElement = taskElement.querySelector(".task-item");
        if (taskItemElement) {
            taskItemElement.classList.toggle("completed", updatedTask.status === "Completed");
        }
        const checkbox = taskElement.querySelector(".task-checkbox");
        if (checkbox) {
            checkbox.checked = updatedTask.status === "Completed";
        }

        // Update due date
        this.updateDueDateDisplay(taskId, updatedTask.dueDate);

        // Update recurring indicator
        let recurringIndicator = taskElement.querySelector(".recurring-indicator");

        if (updatedTask.recurring && typeof updatedTask.recurring === "object" && Object.keys(updatedTask.recurring).length > 0) {
            // If indicator doesn't exist, create it
            if (!recurringIndicator) {
                recurringIndicator = document.createElement("span");
                recurringIndicator.className = "recurring-indicator recurring-svg";
                recurringIndicator.innerHTML = createSVG("recurring", 18, 18, "recurring-svg");
                recurringIndicator.addEventListener("click", (e) => ModalManager.showRecurringEditForm(taskId, e));

                const summaryMeta = taskElement.querySelector(".task-summary-meta");
                if (summaryMeta) {
                    const dueContainer = summaryMeta.querySelector(".due-date-container");
                    summaryMeta.insertBefore(recurringIndicator, dueContainer);
                }
            }

            // Update recurring indicator data
            recurringIndicator.dataset.recurring = JSON.stringify(updatedTask.recurring);
            recurringIndicator.title = this.UIManager.getRecurringDescription(updatedTask.recurring);
        } else if (recurringIndicator) {
            // Remove if no longer recurring
            recurringIndicator.remove();
        }

        // Update category
        const categoryElement = taskElement.querySelector(".meta-row .meta-value");
        if (categoryElement) {
            const category = DataManager.state.categories.find((c) => c.id === updatedTask.categoryId)?.name || "None";
            categoryElement.textContent = category;
        }

        // Update priority
        this.updatePriorityDisplay(taskId, updatedTask.priority);
    },

    editTaskTitle: function (event, taskId) {
        const titleSpan = event.currentTarget;
        const container = titleSpan.closest(".title-container");
        const input = container.querySelector(".title-edit");
        titleSpan.style.visibility = "hidden";
        input.style.display = "block";
        input.focus();
    },

    finishTitleEdit: function (container) {
        const titleSpan = container.querySelector(".task-title");
        const input = container.querySelector(".title-edit");

        input.style.display = "none";
        titleSpan.style.visibility = "visible";
    },

    editTaskDescription: function (event, taskId) {
        const descriptionDiv = event.currentTarget;
        const container = descriptionDiv.closest(".description-container");
        const textarea = container.querySelector(".description-edit");
        textarea.style.height = `${descriptionDiv.offsetHeight}px`;
        descriptionDiv.style.visibility = "hidden";
        textarea.style.display = "block";
        textarea.focus();
        textarea.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = `${this.scrollHeight}px`;
        });
    },

    finishDescriptionEdit: function (container) {
        const descriptionDiv = container.querySelector(".description");
        const textarea = container.querySelector(".description-edit");
        textarea.style.display = "none";
        descriptionDiv.style.visibility = "visible";
    },

    toggleDueDateDropdown: function (event, taskId) {
        const container = event.currentTarget.closest(".meta-item");
        const dropdown = container.querySelector(".date-picker-dropdown");
        document.querySelectorAll(".date-picker-dropdown").forEach((d) => {
            if (d !== dropdown) d.style.display = "none";
        });

        dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
        if (dropdown.style.display === "flex") {
            const closeDropdown = (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = "none";
                    document.removeEventListener("click", closeDropdown);
                }
            };
            setTimeout(() => document.addEventListener("click", closeDropdown), 0);
        }
    },

    setQuickDate: function (event, taskId, type) {
        event.stopPropagation();
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        let date;
        switch (type) {
            case "today":
                date = today;
                break;
            case "tomorrow":
                date = new Date(today);
                date.setUTCDate(today.getUTCDate() + 1);
                break;
            case "nextWeek":
                date = new Date(today);
                date.setUTCDate(today.getUTCDate() + 7);
                break;
        }
        const formattedDate = date.toISOString().split("T")[0];
        this.updateDueDateDisplay(taskId, formattedDate);
        TaskManager.updateTaskField(taskId, "dueDate", formattedDate);
    },

    updateDueDateDisplay: function (taskId, newDate) {
        const display = document.querySelector(`.task-container[data-task-id="${taskId}"] .due-date-display`);
        if (!display) return;

        display.setAttribute("data-raw-date", newDate);
        display.textContent = `${newDate ? "Due: " : ""}${this.UIManager.formatDateForDisplay(newDate)}`;
    },

    updatePriorityDisplay: function (taskId, priority) {
        const priorityElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .priority`);

        if (priorityElement) {
            priorityElement.textContent = priority;
            priorityElement.className = `priority priority-${priority}`;
        }
    },
};
