import { UIManager } from "./UIManager.js";
import { DataManager } from "./DataManager.js";
import APIManager from "./APIManager.js";
import { createSVG } from "./SVGIcons.js";

export const ModalManager = {
    elements: {},

    init: function () {
        // Cache modal elements for efficient access
        this.elements = {
            taskFormModal: document.getElementById("taskForm"),
            taskFormElement: document.getElementById("taskFormElement"),
            recurringEditModal: document.getElementById("recurringEditModal"),
            categoryModal: document.getElementById("categoryModal"),
            tagModal: document.getElementById("tagModal"),
            modalPriorityDisplay: document.getElementById("modalPriorityDisplay"),
            modalDatePickerDropdown: document.getElementById("modalDatePickerDropdown"),
            modalDateInput: document.getElementById("dueDate"),
            modalPriorityDropdown: document.getElementById("modalPriorityDropdown"),
            priorityHidden: document.getElementById("priorityHidden"),
            openDueDatePicker: document.getElementById("openDueDatePicker"),
            modalDueDateDisplay: document.getElementById("modalDueDateDisplay"),
            recurringPattern: document.getElementById("recurringPattern"),
            recurringOptions: document.querySelector(".recurring-options"),
            taskFormMonthlyDay: document.getElementById("monthlyDay"),
            taskFormByMonthDay: document.getElementById("byMonthDay"),
            taskFormCustomRepeat: document.getElementById("customRepeat"),
            taskFormWeeklyDays: document.getElementById("weeklyDays"),
            taskFormOccurenceCount: document.getElementById("occurenceCount"),
            taskFormEndDate: document.getElementById("endDate"),
            taskNameInput: document.getElementById("taskName"),
            taskCategorySelect: document.getElementById("taskCategory"),
            newCategoryNameInput: document.getElementById("newCategoryName"),
            categoryModalList: document.getElementById("categoryModalList"),
            taskTagSelect: document.getElementById("availableTagsSelect"),
            selectedTagsDisplay: document.getElementById("selectedTagsDisplay"),
            newTagNameInput: document.getElementById("newTagName"),
            tagModalList: document.getElementById("tagModalList"),
        };

        // Setup event listeners for modal close buttons
        document.getElementById("recurringModalClose").addEventListener("click", this.hideRecurringEditForm.bind(this));
        document.getElementById("taskModalClose").addEventListener("click", this.hideTaskForm.bind(this));
        document.getElementById("categoryModalClose").addEventListener("click", this.hideCategoryForm.bind(this));
        document.getElementById("tagModalClose").addEventListener("click", this.hideTagForm.bind(this));

        // Date Picker controls for the main task modal
        if (this.elements.openDueDatePicker) {
            // Check if the display element exists
            this.elements.openDueDatePicker.addEventListener("click", (e) => this.toggleDueDateDropdown(e)); // Attach to the display span
            this.elements.modalDatePickerDropdown.querySelector("#quickDateClear").addEventListener("click", (e) => this.clearDueDate(e));
            this.elements.modalDatePickerDropdown.querySelector("#quickDateToday").addEventListener("click", (e) => this.setQuickDate(e, "today"));
            this.elements.modalDatePickerDropdown.querySelector("#quickDateTomorrow").addEventListener("click", (e) => this.setQuickDate(e, "tomorrow"));
            this.elements.modalDatePickerDropdown.querySelector("#quickDateNextWeek").addEventListener("click", (e) => this.setQuickDate(e, "nextWeek"));
            this.elements.modalDateInput.addEventListener("change", (e) => this.updateDueDate(e)); // Attach to the date input
        }

        // Priority Picker controls for the main task modal
        if (this.elements.modalPriorityDisplay) {
            // This is the span inside #openPriorityPicker
            this.elements.taskFormModal.querySelector("#openPriorityPicker").addEventListener("click", (e) => this.togglePriorityDropdown(e));
            // Attach listeners to priority options within the modal
            this.elements.modalPriorityDropdown.querySelectorAll(".priority-option").forEach((option) => {
                option.addEventListener("click", (e) => {
                    e.stopPropagation(); // Prevent click from bubbling up and closing the dropdown immediately
                    const priority = e.target.textContent.trim();
                    this.updatePriorityDisplay(priority); // Update UI and hidden input
                });
            });
        }

        // Category Modal controls
        document.getElementById("showCategoryForm").addEventListener("click", () => this.showCategoryForm());
        document.getElementById("showCategoryForm").innerHTML = createSVG("edit", 16, 16);
        document.getElementById("categoryIconCollapsed").innerHTML = createSVG("category", 22, 22, "icon-filled");
        document.getElementById("addCategoryBtn").addEventListener("click", this.handleAddCategory.bind(this));

        // Tag Modal controls
        document.getElementById("showTagForm").addEventListener("click", () => this.showTagForm());
        document.getElementById("showTagForm").innerHTML = createSVG("edit", 16, 16);
        document.getElementById("tagIconCollapsed").innerHTML = createSVG("tag", 22, 22, "icon-filled");
        document.getElementById("addTagBtn").addEventListener("click", this.handleAddTag.bind(this));

        // Settings Modal controls
        document.getElementById("settingsIconCollapsed").innerHTML = createSVG("settings", 22, 22, "icon-filled");
    },

    // --- Task Form Modal (Add/Edit Task) ---
    showTaskForm: function (taskIdToEdit = null, parentIdForNew = null) {
        const formTitle = this.elements.taskFormModal.querySelector("h3");
        const submitButton = this.elements.taskFormModal.querySelector("#taskFormSubmit");
        const parentIdField = this.elements.taskFormModal.querySelector("#parentTaskId");
        const taskIdField = this.elements.taskFormModal.querySelector("#taskId");

        // Reset form and clear ID fields
        this.hideTaskForm();

        // Populate category dropdown with current categories from DataManager
        this.elements.taskCategorySelect.innerHTML = DataManager.state.categories.map((cat) => `<option value="${cat.id ?? ""}">${cat.name}</option>`).join("");

        this.elements.taskTagSelect.innerHTML = DataManager.state.tags.map((tag) => `<option value="${tag.id ?? ""}">${tag.name}</option>`).join("");

        if (taskIdToEdit) {
            // --- EDIT MODE ---
            const task = DataManager.getTaskById(taskIdToEdit);
            if (!task) {
                console.error("Task not found for editing:", taskIdToEdit);
                UIManager.showErrorMessage("Task not found for editing.", "error");
                return;
            }

            if (formTitle) formTitle.textContent = "Edit Task";
            if (submitButton) submitButton.textContent = "Save Changes";
            if (taskIdField) taskIdField.value = taskIdToEdit;
            if (parentIdField) parentIdField.value = task.parentTaskId || "";

            this.prepopulateTaskForm(task);
        } else {
            // --- ADD MODE ---
            if (formTitle) formTitle.textContent = parentIdForNew ? "Add Subtask" : "New Task";
            if (submitButton) submitButton.textContent = parentIdForNew ? "Add Subtask" : "Add Task";
            if (taskIdField) taskIdField.value = "";
            if (parentIdField) parentIdField.value = parentIdForNew || "";

            // Set defaults for a new task
            const defaultPriority = "Medium";
            this.updatePriorityDisplay(defaultPriority);
            this.elements.modalDueDateDisplay.textContent = "No Due Date";
            this.populateTagSelectField([]);
            this.populateTaskFormRecurringFields({}); // Reset recurring fields for new task
        }

        // Display the modal and focus on the task name input
        this.elements.taskFormModal.style.display = "block";
        if (this.elements.taskNameInput) this.elements.taskNameInput.focus();
    },

    prepopulateTaskForm: function (task) {
        this.elements.taskNameInput.value = task.title;
        this.elements.taskFormModal.querySelector("#description").value = task.description;
        this.elements.taskFormModal.querySelector("#dueDate").value = task.dueDate;
        this.elements.modalDueDateDisplay.textContent = task.dueDate ? UIManager.formatDateForDisplay(task.dueDate) : "No Due Date";
        const priority = task.priority || "Medium";
        this.updatePriorityDisplay(priority);
        this.elements.taskCategorySelect.value = task.categoryId || "";
        this.populateTagSelectField(task.tags || []);
        this.elements.taskTagSelect.value = task.tagId || "";
        this.populateTaskFormRecurringFields(task.recurring || {});
    },

    populateTaskFormRecurringFields: function (recurringData) {
        // Reset all recurring fields to default "none" state first
        this.elements.recurringPattern.value = "none";
        this.elements.recurringOptions.style.display = "none";
        this.elements.taskFormCustomRepeat.style.display = "none";
        this.elements.taskFormWeeklyDays.style.display = "none";
        this.elements.taskFormMonthlyDay.style.display = "none"; // Reset monthly day visibility
        this.elements.taskFormByMonthDay.value = ""; // Reset monthly day input
        this.elements.taskFormOccurenceCount.value = 1;
        this.elements.taskFormOccurenceCount.disabled = true;
        this.elements.taskFormEndDate.value = "";
        this.elements.taskFormEndDate.disabled = true;
        this.elements.taskFormModal.querySelectorAll('input[name="recurringEnd"]').forEach((radio) => {
            if (radio.value === "never") radio.checked = true;
        });
        this.elements.taskFormModal.querySelectorAll(".weekday-checkbox").forEach((cb) => (cb.checked = false));

        if (!recurringData || !recurringData.frequency || recurringData.frequency === "none") {
            return; // No recurring data or 'none', so reset is enough
        }

        // Populate form fields with existing recurring data
        this.elements.recurringPattern.value = recurringData.frequency;
        this.elements.recurringOptions.style.display = "flex";

        // Show/hide specific sections based on frequency
        this.elements.taskFormCustomRepeat.style.display = recurringData.frequency === "custom" ? "block" : "none";
        this.elements.taskFormWeeklyDays.style.display = recurringData.frequency === "weekly" || recurringData.frequency === "weekday" ? "block" : "none";
        this.elements.taskFormMonthlyDay.style.display = recurringData.frequency === "monthly" ? "block" : "none"; // Show/hide monthly day

        if (recurringData.frequency === "custom" && recurringData.interval) {
            this.elements.taskFormModal.querySelector("#customInterval").value = recurringData.interval.value || 1;
            this.elements.taskFormModal.querySelector("#customUnit").value = recurringData.interval.unit || "days";
        }

        if (recurringData.by_day) {
            const days = recurringData.by_day.split(",");
            this.elements.taskFormModal.querySelectorAll(".weekday-checkbox").forEach((cb) => {
                cb.checked = days.includes(cb.value);
            });
        }

        if (recurringData.by_month_day) {
            this.elements.taskFormByMonthDay.value = recurringData.by_month_day; // Populate by_month_day
        }

        const endType = recurringData.end ? recurringData.end.type : "never";
        this.elements.taskFormModal.querySelectorAll('input[name="recurringEnd"]').forEach((radio) => {
            if (radio.value === endType) radio.checked = true;
        });

        if (endType === "after") {
            this.elements.taskFormOccurenceCount.disabled = false;
            this.elements.taskFormOccurenceCount.value = parseInt(recurringData.end.after_occurrences) || 1;
        } else if (endType === "on") {
            this.elements.taskFormEndDate.disabled = false;
            this.elements.taskFormEndDate.value = recurringData.end.date || "";
        }
    },

    populateTagSelectField: function (tags) {
        this.elements.selectedTagsDisplay.innerHTML = "";

        tags.forEach((tag) => {
            this.addTagToSelected(tag, DataManager.getTagNameById(tag));
        });

        const availableTags = DataManager.state.tags.filter((tag) => !tags.includes(tag.id) && tag.name !== "All");

        this.elements.taskTagSelect.innerHTML = availableTags.map((tag) => `<option value="${tag.id}">${tag.name}</option>`).join("");

        this.elements.taskTagSelect.value = "";
    },

    hideTaskForm: function () {
        // Hide the modal and reset the form
        this.elements.taskFormModal.style.display = "none";
        this.elements.taskFormElement.reset();

        // Reset priority display
        const defaultPriority = "Medium";
        if (this.elements.modalPriorityDisplay) this.elements.modalPriorityDisplay.textContent = defaultPriority;
        if (this.elements.priorityHidden) this.elements.priorityHidden.value = defaultPriority;
        const priorityElement = this.elements.taskFormModal.querySelector(".priority");
        if (priorityElement) priorityElement.className = `priority priority-${defaultPriority}`;

        // Reset due date display
        const dueDateElement = this.elements.taskFormModal.querySelector("#dueDate");
        if (dueDateElement) dueDateElement.value = "";
        if (this.elements.modalDueDateDisplay) this.elements.modalDueDateDisplay.textContent = "None";

        // Reset recurring options display
        if (this.elements.recurringPattern) this.elements.recurringPattern.value = "none";
        if (this.elements.recurringOptions) this.elements.recurringOptions.style.display = "none";
        if (this.elements.taskFormCustomRepeat) this.elements.taskFormCustomRepeat.style.display = "none";
        if (this.elements.taskFormMonthlyDay) this.elements.taskFormMonthlyDay.style.display = "none"; // Reset monthly day visibility
        if (this.elements.taskFormByMonthDay) this.elements.taskFormByMonthDay.value = ""; // Reset monthly day input
        if (this.elements.taskFormWeeklyDays) this.elements.taskFormWeeklyDays.style.display = "none";
        if (this.elements.taskFormOccurenceCount) {
            this.elements.taskFormOccurenceCount.value = 1;
            this.elements.taskFormOccurenceCount.disabled = true;
        }
        if (this.elements.taskFormEndDate) {
            this.elements.taskFormEndDate.value = "";
            this.elements.taskFormEndDate.disabled = true;
        }
        this.elements.taskFormModal.querySelectorAll('input[name="recurringEnd"]').forEach((radio) => {
            if (radio.value === "never") radio.checked = true;
        });
    },

    // --- Recurring Edit Modal ---
    showRecurringEditForm: function (taskId) {
        const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
        if (!taskElement) {
            console.error("Task element not found:", taskId);
            return;
        }
        document.getElementById("editRecurringTaskId").value = taskId;

        const recurringIndicator = taskElement.querySelector(".recurring-indicator");
        if (!recurringIndicator) {
            console.error("No recurring data found for task:", taskId);
            return;
        }

        let recurringData;
        try {
            const rawData = recurringIndicator.getAttribute("data-recurring");
            recurringData = rawData ? JSON.parse(rawData) : {};
        } catch (e) {
            console.error("Error parsing recurring data:", e);
            recurringData = {};
        }

        this.populateRecurringEditForm(recurringData);
        this.elements.recurringEditModal.style.display = "block";
    },

    populateRecurringEditForm: function (recurringData) {
        const patternSelect = document.getElementById("editRecurringPattern");
        const customRepeatDiv = document.querySelector("#recurringEditModal .custom-repeat");
        const weeklyDaysDiv = document.querySelector("#recurringEditModal .weekly-days");
        const monthlyDayDiv = document.querySelector("#recurringEditModal .monthly-day");
        const endTypeRadios = document.getElementsByName("editRecurringEnd");
        const occurrenceCount = document.getElementById("editOccurenceCount");
        const endDate = document.getElementById("editEndDate");
        const byMonthDayInput = document.getElementById("editByMonthDay");
        const weekdayCheckboxes = document.querySelectorAll("#recurringEditModal .weekday-checkbox");

        // Reset form fields to default "does not repeat" state
        if (!recurringData || !recurringData.frequency || recurringData.frequency === "none") {
            patternSelect.value = "none";
            customRepeatDiv.style.display = "none";
            weeklyDaysDiv.style.display = "none";
            monthlyDayDiv.style.display = "none";
            occurrenceCount.value = 1;
            occurrenceCount.disabled = true;
            endDate.value = "";
            endDate.disabled = true;
            endTypeRadios.forEach((radio) => {
                if (radio.value === "never") radio.checked = true;
            });
            weekdayCheckboxes.forEach((cb) => (cb.checked = false));
            byMonthDayInput.value = "";
        } else {
            // Populate form fields with existing recurring data
            patternSelect.value = recurringData.frequency;
            customRepeatDiv.style.display = recurringData.frequency === "custom" ? "block" : "none";
            weeklyDaysDiv.style.display = recurringData.frequency === "weekly" || recurringData.frequency === "weekday" ? "block" : "none";
            monthlyDayDiv.style.display = recurringData.frequency === "monthly" ? "block" : "none";

            if (recurringData.frequency === "custom" && recurringData.interval) {
                document.getElementById("editCustomInterval").value = recurringData.interval.value || 1;
                document.getElementById("editCustomUnit").value = recurringData.interval.unit || "days";
            }

            if (recurringData.by_day) {
                const days = recurringData.by_day.split(",");
                weekdayCheckboxes.forEach((cb) => {
                    cb.checked = days.includes(cb.value);
                });
            } else {
                weekdayCheckboxes.forEach((cb) => (cb.checked = false));
            }

            if (recurringData.by_month_day) {
                byMonthDayInput.value = recurringData.by_month_day;
            } else {
                byMonthDayInput.value = "";
            }

            const endType = recurringData.end ? recurringData.end.type : "never";
            endTypeRadios.forEach((radio) => {
                radio.checked = radio.value === endType;
            });

            if (endType === "after") {
                occurrenceCount.disabled = false;
                occurrenceCount.value = parseInt(recurringData.end.after_occurrences) || 1;
                endDate.disabled = true;
                endDate.value = "";
            } else if (endType === "on") {
                endDate.disabled = false;
                endDate.value = recurringData.end.date || "";
                occurrenceCount.disabled = true;
                occurrenceCount.value = 1;
            } else {
                occurrenceCount.disabled = true;
                occurrenceCount.value = 1;
                endDate.disabled = true;
                endDate.value = "";
            }
        }
    },

    hideRecurringEditForm: function () {
        this.elements.recurringEditModal.style.display = "none";
    },

    // Setup for recurring controls in the main task form
    setupRecurringControls: function () {
        const patternSelect = this.elements.recurringPattern;
        const recurringOptions = this.elements.recurringOptions;
        const customRepeatDiv = this.elements.taskFormCustomRepeat;
        const monthlyDayDiv = this.elements.taskFormMonthlyDay; // Get reference to monthly day div
        const weeklyDaysDiv = this.elements.taskFormWeeklyDays;
        const endTypeRadios = document.getElementsByName("recurringEnd");
        const occurenceCount = document.getElementById("occurenceCount");
        const endDate = document.getElementById("endDate");

        patternSelect.addEventListener("change", (e) => {
            monthlyDayDiv.style.display = e.target.value === "monthly" ? "block" : "none"; // Show/hide monthly day
            const showRecurringOptions = e.target.value !== "none";
            weeklyDaysDiv.style.display = e.target.value === "weekly" || e.target.value === "weekday" ? "block" : "none";
            recurringOptions.style.display = showRecurringOptions ? "flex" : "none";
            customRepeatDiv.style.display = e.target.value === "custom" ? "block" : "none";
        });

        endTypeRadios.forEach((radio) => {
            radio.addEventListener("change", (e) => {
                occurenceCount.disabled = e.target.value !== "after";
                endDate.disabled = e.target.value !== "on";
                if (e.target.value === "after") {
                    occurenceCount.disabled = false;
                    occurenceCount.focus();
                } else if (e.target.value === "on") {
                    endDate.disabled = false;
                    endDate.focus();
                }
            });
        });
    },

    updateDueDate: function (event) {
        event.stopPropagation();
        const newDueDate = event.target.value;
        this.updateDueDateDisplay(newDueDate);
    },

    updatePriority: function (event, priority) {
        event.stopPropagation();
        this.updatePriorityDisplay(priority);
    },

    // Setup for recurring controls in the recurring edit modal
    setupRecurringEditControls: function (handlers) {
        const patternSelect = document.getElementById("editRecurringPattern");
        const recurringOptionsDiv = document.querySelector("#recurringEditModal .recurring-options");
        const customRepeatDiv = document.querySelector("#recurringEditModal .custom-repeat");
        const endTypeRadios = document.getElementsByName("editRecurringEnd");
        const occurenceCount = document.getElementById("editOccurenceCount");
        const endDate = document.getElementById("editEndDate");
        const recurringEditForm = document.getElementById("recurringEditForm");

        if (patternSelect) {
            patternSelect.addEventListener("change", (e) => {
                recurringOptionsDiv.style.display = e.target.value === "none" ? "none" : "flex";
                customRepeatDiv.style.display = e.target.value === "custom" ? "block" : "none";

                const val = e.target.value;
                document.querySelector("#recurringEditModal .custom-repeat").style.display = val === "custom" ? "block" : "none";
                document.querySelector("#recurringEditModal .weekly-days").style.display = val === "weekly" || val === "weekday" ? "block" : "none";
                document.querySelector("#recurringEditModal .monthly-day").style.display = val === "monthly" ? "block" : "none";
            });
        }
        endTypeRadios.forEach((radio) => {
            radio.addEventListener("change", (e) => {
                occurenceCount.disabled = e.target.value !== "after";
                endDate.disabled = e.target.value !== "on";
            });
        });
        if (recurringEditForm) {
            recurringEditForm.addEventListener("submit", (e) => {
                e.preventDefault();
                if (handlers && handlers.onRecurringEditSubmit) {
                    handlers.onRecurringEditSubmit(e);
                }
            });
        }
    },

    // --- Date Picker (within modal) ---
    toggleDueDateDropdown: function (event) {
        const container = event.currentTarget.closest(".due-date-container");
        const dropdown = this.elements.modalDatePickerDropdown;
        const dueDateLabel = document.querySelector('label[for="dueDate"]');

        // Toggle display of the current dropdown
        dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
        if (dropdown.style.display === "flex") {
            // Add a click listener to close the dropdown when clicking outside
            const closeDropdown = (e) => {
                if (!container.contains(e.target) || e.target === dueDateLabel) {
                    dropdown.style.display = "none";
                    document.removeEventListener("click", closeDropdown);
                }
            };
            // Use setTimeout to allow the current click event to bubble up and complete
            setTimeout(() => {
                document.addEventListener("click", closeDropdown);
            }, 0);
        }
    },

    setQuickDate: function (event, type) {
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
        const formattedDate = date.toISOString().split("T")[0]; // Get YYYY-MM-DD format
        this.updateDueDateDisplay(formattedDate);
    },

    clearDueDate: function (event) {
        event.stopPropagation();
        this.updateDueDateDisplay("");
    },

    updateDueDateDisplay: function (newDate) {
        const dropdown = this.elements.modalDatePickerDropdown;
        const dateInput = this.elements.modalDateInput;
        const displayElement = this.elements.modalDueDateDisplay;

        if (!dropdown || !dateInput || !displayElement) {
            return; // Elements not found, likely not in the modal context
        }

        displayElement.textContent = UIManager.formatDateForDisplay(newDate);
        dateInput.value = newDate;

        // Always close the dropdown after selection
        dropdown.style.display = "none";
    },

    setupTagControls: function () {
        // Setup event listeners for tag modal controls
        const availableTagsSelect = this.elements.taskFormModal.querySelector("#availableTagsSelect");

        availableTagsSelect.addEventListener("change", (event) => {
            const selectedOption = event.target.options[event.target.selectedIndex];
            const tagValue = selectedOption.value;
            const tagText = selectedOption.textContent;

            if (tagValue) {
                // Ensure a valid option was selected (not the disabled placeholder)
                this.addTagToSelected(tagValue, tagText);
                selectedOption.remove(); // Remove the option from the dropdown
                availableTagsSelect.value = ""; // Reset dropdown to placeholder
            }
        });
    },

    addTagToSelected: function (tagValue, tagText) {
        // Create the pill element
        const tagPill = document.createElement("div");
        tagPill.classList.add("selected-tag-pill");
        tagPill.dataset.value = tagValue; // Store the original value

        // Create the text span
        const tagTextSpan = document.createElement("span");
        tagTextSpan.textContent = tagText;
        tagPill.appendChild(tagTextSpan);

        // Create the remove button
        const removeButton = document.createElement("button");
        removeButton.classList.add("remove-tag-button");
        removeButton.innerHTML = "&times;"; // 'x' icon
        removeButton.title = `Remove ${tagText}`;
        removeButton.addEventListener("click", () => this.removeTagFromSelected(tagPill, tagValue, tagText));
        tagPill.appendChild(removeButton);

        const selectedTagsDisplay = this.elements.taskFormModal.querySelector("#selectedTagsDisplay");
        selectedTagsDisplay.appendChild(tagPill);
    },

    removeTagFromSelected: function (tagPill, tagValue, tagText) {
        tagPill.remove(); // Remove the pill from the DOM

        // Add the option back to the available tags select, maintaining sort order
        const newOption = document.createElement("option");
        newOption.value = tagValue;
        newOption.textContent = tagText;

        const availableTagsSelect = document.getElementById("availableTagsSelect");

        // Find the correct position to re-insert the option
        let inserted = false;
        for (let i = 0; i < availableTagsSelect.options.length; i++) {
            // Skip the disabled "Add Tag..." option
            if (availableTagsSelect.options[i].disabled) continue;

            if (tagText < availableTagsSelect.options[i].textContent) {
                availableTagsSelect.insertBefore(newOption, availableTagsSelect.options[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            availableTagsSelect.appendChild(newOption); // Add to end if no smaller element found
        }

        // Reset the select dropdown to its default "Add Tag..." state
        availableTagsSelect.value = "";
    },

    // --- Priority Picker (within modal) ---
    togglePriorityDropdown: function (event) {
        const container = event.currentTarget.closest(".priority");
        const dropdown = this.elements.modalPriorityDropdown;

        // Toggle display of the current dropdown
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        container.classList.toggle("show");

        // Add a click listener to close the dropdown when clicking outside
        if (dropdown.style.display === "block") {
            const closeDropdown = (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = "none";
                    container.classList.remove("show");
                    document.removeEventListener("click", closeDropdown);
                }
            };
            setTimeout(() => {
                document.addEventListener("click", closeDropdown);
            }, 0);
        }
    },

    updatePriorityDisplay: function (priority) {
        const priorityElement = this.elements.taskFormModal.querySelector(".priority");
        if (!priorityElement) return; // Ensure we are in the modal context

        const dropdown = this.elements.taskFormModal.querySelector(".priority-dropdown"); // Get the dropdown within the modal
        const displayElement = this.elements.modalPriorityDisplay;
        const priorityHidden = this.elements.priorityHidden;

        if (displayElement) displayElement.textContent = priority;
        if (priorityHidden) priorityHidden.value = priority;

        if (priorityElement) {
            priorityElement.className = `priority priority-${priority}`;
        }
        if (dropdown) {
            dropdown.style.display = "none";
        }
    },

    // --- Category Modal ---
    showCategoryForm: function () {
        UIManager.showThrobber("Loading categories");
        this.elements.categoryModal.style.display = "block";
        this.renderCategoryList(); // Render the list of categories inside the modal
    },

    renderCategoryList: async function () {
        const list = this.elements.categoryModalList;
        const categories = DataManager.state.categories.filter((c) => c.id !== null); // Exclude "All" category

        list.innerHTML = categories
            .map(
                (cat) => `
            <li class="form-group" data-id="${cat.id}">
                <input type="text" class="inline-input" value="${cat.name}" />
                <button class="btn saveCategoryBtn" title="Save Category">${createSVG("save", 20, 20, "save-svg")}</button>
                <button class="btn deleteCategoryBtn" title="Delete Category">${createSVG("delete", 20, 20, "delete-svg")}</button>
            </li>
        `
            )
            .join("");

        // Add event listeners for save buttons
        list.querySelectorAll(".saveCategoryBtn").forEach((btn) =>
            btn.addEventListener("click", async (e) => {
                const li = e.target.closest("li");
                const id = parseInt(li.dataset.id);
                const name = li.querySelector("input").value.trim();
                if (!name) return;

                try {
                    UIManager.showThrobber("Updating category");
                    const updated = await APIManager.updateCategory(id, { name });
                    const category = DataManager.state.categories.find((c) => c.id === id);
                    if (category) category.name = updated.name; // Update DataManager state
                    UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
                    UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
                } catch (err) {
                    console.error("Failed to update category", err);
                    UIManager.showErrorMessage(err, "updating category");
                } finally {
                    UIManager.hideThrobber("Updating category");
                }
            })
        );

        // Add event listeners for delete buttons
        list.querySelectorAll(".deleteCategoryBtn").forEach((btn) =>
            btn.addEventListener("click", async (e) => {
                const li = e.target.closest("li");
                const id = parseInt(li.dataset.id);

                try {
                    UIManager.showThrobber("Deleting category");
                    await APIManager.deleteCategory(id);
                    DataManager.state.categories = DataManager.state.categories.filter((c) => c.id !== id); // Update DataManager state
                    UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
                    this.renderCategoryList(); // Re-render the category list in the modal
                    UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
                } catch (err) {
                    console.error("Failed to delete category", err);
                    UIManager.showErrorMessage(err, "deleting category");
                } finally {
                    UIManager.hideThrobber("Deleting category");
                }
            })
        );

        UIManager.hideThrobber("Loading categories");
    },

    handleAddCategory: async function () {
        const name = this.elements.newCategoryNameInput.value.trim();
        if (!name) return;

        try {
            UIManager.showThrobber("Adding category");
            const category = await APIManager.addCategory({ name });
            DataManager.state.categories.push(category); // Add to DataManager state
            UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
            this.renderCategoryList(); // Re-render the category list in the modal
            UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
            this.elements.newCategoryNameInput.value = ""; // Clear input field
        } catch (err) {
            console.error("Failed to add category", err);
            UIManager.showErrorMessage(err, "adding category");
        } finally {
            UIManager.hideThrobber("Adding category");
        }
    },

    hideCategoryForm: function () {
        this.elements.categoryModal.style.display = "none";
    },

    // --- Tag Modal ---
    showTagForm: function () {
        UIManager.showThrobber("Loading tags");
        this.elements.tagModal.style.display = "block";
        this.renderTagList(); // Render the list of tags inside the modal
    },

    renderTagList: async function () {
        const list = this.elements.tagModalList;
        const tags = DataManager.state.tags.filter((c) => c.id !== null); // Exclude "All" tag

        list.innerHTML = tags
            .map(
                (tag) => `
            <li class="form-group" data-id="${tag.id}">
                <input type="text" class="inline-input" value="${tag.name}" />
                <button class="btn saveTagBtn" title="Save Tag">${createSVG("save", 20, 20, "save-svg")}</button>
                <button class="btn deleteTagBtn" title="Delete Tag">${createSVG("delete", 20, 20, "delete-svg")}</button>
            </li>
        `
            )
            .join("");

        // Add event listeners for save buttons
        list.querySelectorAll(".saveTagBtn").forEach((btn) =>
            btn.addEventListener("click", async (e) => {
                const li = e.target.closest("li");
                const id = parseInt(li.dataset.id);
                const name = li.querySelector("input").value.trim();
                if (!name) return;

                try {
                    UIManager.showThrobber("Updating tag");
                    const updated = await APIManager.updateTag(id, { name });
                    const tag = DataManager.state.tags.find((t) => t.id === id);
                    if (tag) tag.name = updated.name; // Update DataManager state
                    UIManager.refreshTagDropdown(); // Refresh the tag dropdown in the task form
                    UIManager.renderTags(DataManager.state.tags); // Re-render sidebar categories
                } catch (err) {
                    console.error("Failed to update tag", err);
                    UIManager.showErrorMessage(err, "updating tag");
                } finally {
                    UIManager.hideThrobber("Updating tag");
                }
            })
        );

        // Add event listeners for delete buttons
        list.querySelectorAll(".deleteTagBtn").forEach((btn) =>
            btn.addEventListener("click", async (e) => {
                const li = e.target.closest("li");
                const id = parseInt(li.dataset.id);

                try {
                    UIManager.showThrobber("Deleting tag");
                    await APIManager.deleteTag(id);
                    DataManager.state.tags = DataManager.state.tags.filter((t) => t.id !== id); // Update DataManager state
                    UIManager.refreshTagDropdown(); // Refresh the tag dropdown in the task form
                    this.renderTagList(); // Re-render the tag list in the modal
                    UIManager.renderTags(DataManager.state.tags); // Re-render sidebar tags
                } catch (err) {
                    console.error("Failed to delete tag", err);
                    UIManager.showErrorMessage(err, "deleting tag");
                } finally {
                    UIManager.hideThrobber("Deleting tag");
                }
            })
        );

        UIManager.hideThrobber("Loading tags");
    },

    handleAddTag: async function () {
        const name = this.elements.newTagNameInput.value.trim();
        if (!name) return;

        try {
            UIManager.showThrobber("Adding tag");
            const tag = await APIManager.addTag({ name });
            DataManager.state.tags.push(tag); // Add to DataManager state
            UIManager.refreshTagDropdown(); // Refresh the tag dropdown in the task form
            this.renderTagList(); // Re-render the tag list in the modal
            UIManager.renderTags(DataManager.state.tags); // Re-render sidebar tags
            this.elements.newTagNameInput.value = ""; // Clear input field
        } catch (err) {
            console.error("Failed to add tag", err);
            UIManager.showErrorMessage(err, "adding tag");
        } finally {
            UIManager.hideThrobber("Adding tag");
        }
    },

    hideTagForm: function () {
        this.elements.tagModal.style.display = "none";
    },
};
