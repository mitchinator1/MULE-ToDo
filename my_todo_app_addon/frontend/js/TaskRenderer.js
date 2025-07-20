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
        const taskData = this.buildTaskData(task);

        const taskItem = document.createElement("div");
        taskItem.className = "task-item";
        taskItem.dataset.taskId = taskData.id;

        if (taskData.status === "Completed") taskItem.classList.add("completed");

        const summary = this.createSummarySection(taskData);
        const details = this.createDetailsSection(taskData);
        const footer = this.createActionsFooter(taskData);

        taskItem.appendChild(summary);
        taskItem.appendChild(details);
        taskItem.appendChild(footer);

        this.attachToggleBehavior(details, footer);

        return taskItem;
    },

    buildTaskData: function (task) {
        const recurringData = typeof task.recurring === "object" ? task.recurring : typeof task.recurring === "string" ? JSON.parse(task.recurring || "{}") : {};

        return {
            id: task.id,
            title: task.title || "Untitled Task",
            description: task.description || "",
            dueDate: task.dueDate || "",
            status: task.status || "Not Started",
            priority: task.priority || "Medium",
            categoryId: task.categoryId || null,
            tags: task.tags || [],
            hasSubtasks: task.hasSubtasks || false,
            recurring: recurringData,
        };
    },

    createSummarySection: function (taskData) {
        const summary = document.createElement("div");
        summary.className = "task-summary";

        // Checkbox for completion
        const checkboxContainer = document.createElement("div");
        checkboxContainer.className = "task-checkbox-container";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.title = "Mark as Completed";
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
        titleSpan.addEventListener("click", (e) => this.editTaskTitle(e));
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
        priorityDisplay.className = `priority priority-${taskData.priority}`;
        priorityDisplay.textContent = taskData.priority;
        priorityDisplay.title = "Priority";
        priorityDisplay.addEventListener("click", (e) => this.UIManager.toggleUniversalPriorityDropdown(e.currentTarget, taskData.id));
        summaryMeta.appendChild(priorityDisplay);

        summary.appendChild(summaryMeta);
        return summary;
    },

    createDetailsSection: function (taskData) {
        const detailsCollapsible = document.createElement("div");
        detailsCollapsible.className = "task-details-collapsible";

        // Description
        const descContainer = document.createElement("div");
        descContainer.className = "description-container";
        const desc = document.createElement("div");
        desc.className = "description";
        desc.innerHTML = taskData.description || '<span class="placeholder">Add description...</span>';
        desc.addEventListener("click", (e) => this.editTaskDescription(e));
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

        // Meta Section (Category, Tags, Status)
        const extendedMeta = document.createElement("div");
        extendedMeta.className = "task-meta-extended";
        extendedMeta.innerHTML = `
			<div class="meta-row"><span class="meta-label">Category:</span> <span class="meta-value category-container">${DataManager.getCategoryNameById(taskData.categoryId) || "None"}</span></div>
			<div class="meta-row"><span class="meta-label">Tags:</span>
                <span class="meta-value tag-pill-container">
                    ${taskData.tags?.length ? taskData.tags.map((tag) => `<span class="tag-pill">${DataManager.getTagNameById(tag)}</span>`).join("") : "None"}
                </span>
            </div>
			<div class="meta-row"><span class="meta-label">Status:</span> <span class="meta-value status">${taskData.status}</span></div>
		`;
        detailsCollapsible.appendChild(extendedMeta);

        // Subtask Expander
        const expand = document.createElement("div");
        expand.className = `task-expand-indicator ${taskData.hasSubtasks ? "" : "hidden"}`;
        expand.innerHTML = "<span>Subtasks</span>";
        expand.addEventListener("click", (e) => this.UIManager.toggleSubtasks(taskData.id, e));
        detailsCollapsible.appendChild(expand);

        return detailsCollapsible;
    },

    createActionsFooter: function (taskData) {
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

        // Elaborate button
        const elaborateBtn = document.createElement("button");
        elaborateBtn.className = "btn";
        elaborateBtn.title = "Elaborate Task with AI";
        elaborateBtn.innerHTML = createSVG("elaborate", 20, 20, "elaborate-svg");
        elaborateBtn.addEventListener("click", () => {
            TaskManager.elaborateTaskWithAI(taskData.id);
        });
        actionsFooter.appendChild(elaborateBtn);

        return actionsFooter;
    },

    attachToggleBehavior: function (details, footer) {
        const toggleBtn = footer.querySelector(".details-toggle-btn");
        if (!toggleBtn) return;

        toggleBtn.addEventListener("click", (e) => {
            const isCollapsing = details.classList.contains("expanded");
            const detailsText = toggleBtn.querySelector("span");

            if (isCollapsing) {
                details.style.maxHeight = details.scrollHeight + "px";
                details.offsetHeight;

                details.classList.remove("expanded");
                toggleBtn.classList.remove("expanded");
                if (detailsText) detailsText.textContent = "Details";
                details.style.maxHeight = "0px";
            } else {
                details.classList.add("expanded");
                toggleBtn.classList.add("expanded");
                if (detailsText) detailsText.textContent = "Hide";
                details.style.maxHeight = details.scrollHeight + "px";
            }
            setTimeout(() => this.UIManager.updateParentContainers(details), 0);
        });
    },

    updateTaskElement: function (taskId, updatedTask) {
        const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        this.updateTitleDisplay(taskId, updatedTask.title || "Untitled Task");
        this.updateDescriptionDisplay(taskId, updatedTask.description || "");
        this.updateDueDateDisplay(taskId, updatedTask.dueDate);
        this.updateRecurringDisplay(taskId, updatedTask);
        this.updatePriorityDisplay(taskId, updatedTask.priority);
        this.updateCategoryDisplay(taskId, updatedTask.categoryId);
        this.updateTagsDisplay(taskId, updatedTask.tags || []);
        this.updateStatusDisplay(taskId, updatedTask.status || "Not Started");

        // Update completed status
        const taskItemElement = taskElement.querySelector(".task-item");
        if (taskItemElement) {
            taskItemElement.classList.toggle("completed", updatedTask.status === "Completed");
        }
        const checkbox = taskElement.querySelector(".task-checkbox");
        if (checkbox) {
            checkbox.checked = updatedTask.status === "Completed";
        }
    },

    editTaskTitle: function (event) {
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

    editTaskDescription: function (event) {
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

    updateTitleDisplay: function (taskId, newTitle) {
        const titleElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .task-title`);
        if (!titleElement) return;

        titleElement.textContent = newTitle;
        titleElement.style.visibility = "visible";
        const titleEditElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .title-edit`);
        if (titleEditElement) {
            titleEditElement.value = newTitle || "Untitled Task";
            titleEditElement.style.display = "none";
        }
    },

    updateDescriptionDisplay: function (taskId, newDescription) {
        const descriptionElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .description`);
        if (!descriptionElement) return;
        descriptionElement.innerHTML = newDescription || '<span class="placeholder">Add description...</span>';
        descriptionElement.style.visibility = "visible";
        const descriptionEditElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .description-edit`);
        if (descriptionEditElement) {
            descriptionEditElement.value = newDescription || "";
            descriptionEditElement.style.display = "none";
        }
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

    updateRecurringDisplay: function (taskId, task) {
        const recurringIndicator = document.querySelector(`.task-container[data-task-id="${taskId}"] .recurring-indicator`);
        if (!recurringIndicator) return;

        if (task.recurring && typeof task.recurring === "object" && Object.keys(task.recurring).length > 0) {
            recurringIndicator.style.display = "inline-block";
            recurringIndicator.title = this.UIManager.getRecurringDescription(task.recurring);
            recurringIndicator.dataset.recurring = JSON.stringify(task.recurring);
        } else {
            recurringIndicator.style.display = "none";
        }
    },

    updateCategoryDisplay: function (taskId, categoryId) {
        const categoryElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .meta-row .category-container`);
        if (categoryElement) {
            const categoryName = DataManager.getCategoryNameById(categoryId) || "None";
            categoryElement.textContent = categoryName;
        }
    },

    updateTagsDisplay: function (taskId, tags) {
        const tagsElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .meta-row .tag-pill-container`);
        if (tagsElement) {
            tagsElement.innerHTML = tags.length ? tags.map((tag) => `<span class="tag-pill">${DataManager.getTagNameById(tag)}</span>`).join("") : "None";
        }
    },

    updateStatusDisplay: function (taskId, status) {
        const statusElement = document.querySelector(`.task-container[data-task-id="${taskId}"] .meta-row .status`);
        if (statusElement) {
            statusElement.textContent = status || "Not Started";
        }
    },
};
