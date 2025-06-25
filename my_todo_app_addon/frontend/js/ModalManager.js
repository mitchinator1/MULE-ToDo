import { UIManager } from './UIManager.js';
import { DataManager } from './DataManager.js';
import { TaskManager } from './TaskManager.js';
import APIManager from './APIManager.js';

export const ModalManager = {
    elements: {},

    init: function () {
        // Cache modal elements for efficient access
        this.elements = {
            taskFormModal: document.getElementById('taskForm'),
            taskFormElement: document.getElementById('taskFormElement'),
            recurringEditModal: document.getElementById('recurringEditModal'),
            categoryModal: document.getElementById('categoryModal'),
            modalPriorityDisplay: document.getElementById('modalPriorityDisplay'),
            priorityHidden: document.getElementById('priorityHidden'),
            modalDueDateDisplay: document.getElementById('modalDueDateDisplay'),
            recurringPattern: document.getElementById('recurringPattern'),
            recurringOptions: document.querySelector('.recurring-options'),
            taskNameInput: document.getElementById('taskName'),
            taskCategorySelect: document.getElementById('taskCategory'),
            newCategoryNameInput: document.getElementById('newCategoryName'),
            categoryModalList: document.getElementById('categoryModalList'),
        };

        // Setup event listeners for modal close buttons
        document.getElementById('recurringModalClose').addEventListener('click', this.hideRecurringEditForm.bind(this));
        document.getElementById('taskModalClose').addEventListener('click', this.hideTaskForm.bind(this));
        document.getElementById('categoryModalClose').addEventListener('click', this.hideCategoryForm.bind(this));

        // Date Picker controls for the main task modal
        document.getElementById('openDueDatePicker').addEventListener('click', (e) => this.toggleDueDateDropdown(e));
        document.getElementById('quickDateClear').addEventListener('click', (e) => this.clearDueDate(e));
        document.getElementById('quickDateToday').addEventListener('click', (e) => this.setQuickDate(e, 'today'));
        document.getElementById('quickDateTomorrow').addEventListener('click', (e) => this.setQuickDate(e, 'tomorrow'));
        document.getElementById('quickDateNextWeek').addEventListener('click', (e) => this.setQuickDate(e, 'nextWeek'));

        // Priority Picker controls for the main task modal
        document.getElementById('openPriorityPicker').addEventListener('click', (e) => this.togglePriorityDropdown(e));

        // Category Modal controls
        document.getElementById('showCategoryForm').addEventListener('click', () => this.showCategoryForm());
        document.getElementById('addCategoryBtn').addEventListener('click', this.handleAddCategory.bind(this));
    },

    // --- Task Form Modal (Add/Edit Task) ---
    showTaskForm: function (parentId = null) {
        const formTitle = this.elements.taskFormModal.querySelector('h3');
        const submitButton = this.elements.taskFormModal.querySelector('#taskFormSubmit');
        const parentIdField = this.elements.taskFormModal.querySelector('#parentTaskId');
        const taskIdField = this.elements.taskFormModal.querySelector('#taskId');

        // Reset form and clear ID fields
        this.hideTaskForm();
        if (taskIdField) taskIdField.value = '';
        if (parentIdField) parentIdField.value = parentId || '';

        // Update form title and submit button text based on context
        if (formTitle) formTitle.textContent = parentId ? 'Add Subtask' : 'New Task';
        if (submitButton) submitButton.textContent = parentId ? 'Add Subtask' : 'Add Task';

        // Set default priority for new tasks
        const defaultPriority = 'Medium';
        if (this.elements.modalPriorityDisplay) this.elements.modalPriorityDisplay.textContent = defaultPriority;
        if (this.elements.priorityHidden) this.elements.priorityHidden.value = defaultPriority;
        const priorityElement = this.elements.taskFormModal.querySelector('.priority');
        if (priorityElement) priorityElement.className = `priority priority-${defaultPriority}`;

        // Populate category dropdown with current categories from DataManager
        this.elements.taskCategorySelect.innerHTML = DataManager.state.categories
            .map(cat => `<option value="${cat.id ?? ''}">${cat.name}</option>`)
            .join('');

        // Display the modal and focus on the task name input
        this.elements.taskFormModal.style.display = 'block';
        if (this.elements.taskNameInput) this.elements.taskNameInput.focus();
    },

    hideTaskForm: function () {
        // Hide the modal and reset the form
        this.elements.taskFormModal.style.display = 'none';
        this.elements.taskFormElement.reset();

        // Reset priority display
        const defaultPriority = 'Medium';
        if (this.elements.modalPriorityDisplay) this.elements.modalPriorityDisplay.textContent = defaultPriority;
        if (this.elements.priorityHidden) this.elements.priorityHidden.value = defaultPriority;
        const priorityElement = this.elements.taskFormModal.querySelector('.priority');
        if (priorityElement) priorityElement.className = `priority priority-${defaultPriority}`;

        // Reset due date display
        const dueDateElement = this.elements.taskFormModal.querySelector('#dueDate');
        if (dueDateElement) dueDateElement.value = '';
        if (this.elements.modalDueDateDisplay) this.elements.modalDueDateDisplay.textContent = 'None';

        // Reset recurring options display
        if (this.elements.recurringPattern) this.elements.recurringPattern.value = 'none';
        if (this.elements.recurringOptions) this.elements.recurringOptions.style.display = 'none';
    },

    // --- Recurring Edit Modal ---
    showRecurringEditForm: function (taskId) {
        const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
        if (!taskElement) {
            console.error('Task element not found:', taskId);
            return;
        }
        document.getElementById('editRecurringTaskId').value = taskId;

        const recurringIndicator = taskElement.querySelector('.recurring-indicator');
        if (!recurringIndicator) {
            console.error('No recurring data found for task:', taskId);
            return;
        }

        let recurringData;
        try {
            const rawData = recurringIndicator.getAttribute('data-recurring');
            recurringData = rawData ? JSON.parse(rawData) : {};
        } catch (e) {
            console.error('Error parsing recurring data:', e);
            recurringData = {};
        }

        this.populateRecurringEditForm(recurringData);
        this.elements.recurringEditModal.style.display = 'block';
    },

    populateRecurringEditForm: function (recurringData) {
        const patternSelect = document.getElementById('editRecurringPattern');
        const customRepeatDiv = document.querySelector('#recurringEditModal .custom-repeat');
        const weeklyDaysDiv = document.querySelector('#recurringEditModal .weekly-days');
        const monthlyDayDiv = document.querySelector('#recurringEditModal .monthly-day');
        const endTypeRadios = document.getElementsByName('editRecurringEnd');
        const occurrenceCount = document.getElementById('editOccurenceCount');
        const endDate = document.getElementById('editEndDate');
        const byMonthDayInput = document.getElementById('editByMonthDay');
        const weekdayCheckboxes = document.querySelectorAll('#recurringEditModal .weekday-checkbox');

        // Reset form fields to default "does not repeat" state
        if (!recurringData || !recurringData.frequency || recurringData.frequency === 'none') {
            patternSelect.value = 'none';
            customRepeatDiv.style.display = 'none';
            weeklyDaysDiv.style.display = 'none';
            monthlyDayDiv.style.display = 'none';
            occurrenceCount.value = 1;
            occurrenceCount.disabled = true;
            endDate.value = '';
            endDate.disabled = true;
            endTypeRadios.forEach(radio => {
                if (radio.value === 'never') radio.checked = true;
            });
            weekdayCheckboxes.forEach(cb => cb.checked = false);
            byMonthDayInput.value = '';
        } else {
            // Populate form fields with existing recurring data
            patternSelect.value = recurringData.frequency;
            customRepeatDiv.style.display = recurringData.frequency === 'custom' ? 'block' : 'none';
            weeklyDaysDiv.style.display = (recurringData.frequency === 'weekly' || recurringData.frequency === 'weekday') ? 'block' : 'none';
            monthlyDayDiv.style.display = recurringData.frequency === 'monthly' ? 'block' : 'none';

            if (recurringData.frequency === 'custom' && recurringData.interval) {
                document.getElementById('editCustomInterval').value = recurringData.interval.value || 1;
                document.getElementById('editCustomUnit').value = recurringData.interval.unit || 'days';
            }

            if (recurringData.by_day) {
                const days = recurringData.by_day.split(',');
                weekdayCheckboxes.forEach(cb => {
                    cb.checked = days.includes(cb.value);
                });
            } else {
                weekdayCheckboxes.forEach(cb => cb.checked = false);
            }

            if (recurringData.by_month_day) {
                byMonthDayInput.value = recurringData.by_month_day;
            } else {
                byMonthDayInput.value = '';
            }

            const endType = recurringData.end ? recurringData.end.type : 'never';
            endTypeRadios.forEach(radio => {
                radio.checked = radio.value === endType;
            });

            if (endType === 'after') {
                occurrenceCount.disabled = false;
                occurrenceCount.value = parseInt(recurringData.end.after_occurrences) || 1;
                endDate.disabled = true;
                endDate.value = '';
            } else if (endType === 'on') {
                endDate.disabled = false;
                endDate.value = recurringData.end.date || '';
                occurrenceCount.disabled = true;
                occurrenceCount.value = 1;
            } else {
                occurrenceCount.disabled = true;
                occurrenceCount.value = 1;
                endDate.disabled = true;
                endDate.value = '';
            }
        }
    },

    hideRecurringEditForm: function () {
        this.elements.recurringEditModal.style.display = 'none';
    },

    // Setup for recurring controls in the main task form
    setupRecurringControls: function () {
        const patternSelect = document.getElementById('recurringPattern');
        const recurringOptions = document.querySelector('.recurring-options');
        const customRepeatDiv = document.querySelector('.custom-repeat');
        const endTypeRadios = document.getElementsByName('recurringEnd');
        const occurenceCount = document.getElementById('occurenceCount');
        const endDate = document.getElementById('endDate');

        patternSelect.addEventListener('change', (e) => {
            const showRecurringOptions = e.target.value !== 'none';
            recurringOptions.style.display = showRecurringOptions ? 'block' : 'none';
            customRepeatDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        endTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                occurenceCount.disabled = e.target.value !== 'after';
                endDate.disabled = e.target.value !== 'on';
                if (e.target.value === 'after') {
                    occurenceCount.disabled = false;
                    occurenceCount.focus();
                } else if (e.target.value === 'on') {
                    endDate.disabled = false;
                    endDate.focus();
                }
            });
        });
    },

    // Setup for recurring controls in the recurring edit modal
    setupRecurringEditControls: function (handlers) {
        const patternSelect = document.getElementById('editRecurringPattern');
        const recurringOptionsDiv = document.querySelector('#recurringEditModal .recurring-options');
        const customRepeatDiv = document.querySelector('#recurringEditModal .custom-repeat');
        const endTypeRadios = document.getElementsByName('editRecurringEnd');
        const occurenceCount = document.getElementById('editOccurenceCount');
        const endDate = document.getElementById('editEndDate');
        const recurringEditForm = document.getElementById('recurringEditForm');

        if (patternSelect) {
            patternSelect.addEventListener('change', (e) => {
                recurringOptionsDiv.style.display = e.target.value === 'none' ? 'none' : 'block';
                customRepeatDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';

                const val = e.target.value;
                document.querySelector('#recurringEditModal .custom-repeat').style.display = val === 'custom' ? 'block' : 'none';
                document.querySelector('#recurringEditModal .weekly-days').style.display = val === 'weekly' || val === 'weekday' ? 'block' : 'none';
                document.querySelector('#recurringEditModal .monthly-day').style.display = val === 'monthly' ? 'block' : 'none';
            });
        }
        endTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                occurenceCount.disabled = e.target.value !== 'after';
                endDate.disabled = e.target.value !== 'on';
            });
        });
        if (recurringEditForm) {
            recurringEditForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (handlers && handlers.onRecurringEditSubmit) {
                    handlers.onRecurringEditSubmit(e);
                }
            });
        }
    },

    // --- Date Picker (within modal or task item) ---
    toggleDueDateDropdown: function (event) {
        const container = event.currentTarget.closest('.due-date-container');
        const dropdown = container.querySelector('.date-picker-dropdown');
        // Close any other open dropdowns to prevent multiple open pickers
        document.querySelectorAll('.date-picker-dropdown').forEach(d => {
            if (d !== dropdown) d.style.display = 'none';
        });

        // Toggle display of the current dropdown
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        if (dropdown.style.display === 'flex') {
            // Add a click listener to close the dropdown when clicking outside
            const closeDropdown = (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeDropdown);
                }
            };
            // Use setTimeout to allow the current click event to bubble up and complete
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 0);
        }
    },

    setQuickDate: function (event, type) {
        event.stopPropagation(); // Prevent event from bubbling up and closing dropdown immediately
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        let date;
        switch (type) {
            case 'today': date = today; break;
            case 'tomorrow': date = new Date(today); date.setUTCDate(today.getUTCDate() + 1); break;
            case 'nextWeek': date = new Date(today); date.setUTCDate(today.getUTCDate() + 7); break;
        }
        const formattedDate = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        this.updateDueDateDisplay(formattedDate);
    },

    clearDueDate: function (event) {
        event.stopPropagation();
        this.updateDueDateDisplay('');
    },

    updateDueDateDisplay: function (newDate) {
		const container = document.querySelector('#taskForm .due-date-container');
		if (!container) return;

		const dropdown = container.querySelector('.date-picker-dropdown');
		const dateInput = dropdown.querySelector('.date-input');
		const displayElement = document.getElementById('modalDueDateDisplay');

		displayElement.textContent = UIManager.formatDateForDisplay(newDate);
		dateInput.value = newDate;

		// Always close the dropdown after selection
		dropdown.style.display = 'none';
    },

    // --- Priority Picker (within modal or task item) ---
    togglePriorityDropdown: function (event) {
        event.stopPropagation();
        const container = event.currentTarget.closest('.priority-container');
        const dropdown = container.querySelector('.priority-dropdown');

        // Ensure dropdown has initial display style set to 'none' if not already
        if (!dropdown.style.display) {
            dropdown.style.display = 'none';
        }

        // Close any other open priority dropdowns
        document.querySelectorAll('.priority-dropdown').forEach(d => {
            if (d !== dropdown)
                d.style.display = 'none';
        });
        // Toggle display of the current dropdown
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';

        // Add a click listener to close the dropdown when clicking outside
        if (dropdown.style.display === 'block') {
            const closeDropdown = (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 0);
        }
    },

    updatePriorityDisplay: function (priority) {
		const container = document.querySelector('#taskForm .priority-container');
		if (!container) return;

		const priorityElement = container.querySelector('.priority');
		const dropdown = container.querySelector('.priority-dropdown');
		const displayElement = document.getElementById('modalPriorityDisplay');
		const priorityHidden = document.getElementById('priorityHidden');

		if (displayElement) displayElement.textContent = priority;
		if (priorityHidden) priorityHidden.value = priority;

		if (priorityElement) {
			priorityElement.className = `priority priority-${priority}`;
		}
		if (dropdown) {
			dropdown.style.display = 'none';
		}
	},

    // --- Category Modal ---
    showCategoryForm: function () {
        this.elements.categoryModal.style.display = 'block';
        this.renderCategoryList(); // Render the list of categories inside the modal
    },

    renderCategoryList: async function () {
        const list = this.elements.categoryModalList;
        const categories = DataManager.state.categories.filter(c => c.id !== null); // Exclude "All" category

        list.innerHTML = categories.map(cat => `
            <li class="form-group" data-id="${cat.id}">
                <input type="text" class="inline-input" value="${cat.name}" />
                <button class="btn saveCategoryBtn">💾</button>
                <button class="btn deleteCategoryBtn">🗑️</button>
            </li>
        `).join('');

        // Add event listeners for save buttons
        list.querySelectorAll('.saveCategoryBtn').forEach(btn =>
            btn.addEventListener('click', async e => {
                const li = e.target.closest('li');
                const id = parseInt(li.dataset.id);
                const name = li.querySelector('input').value.trim();
                if (!name) return;

                try {
                    const updated = await APIManager.updateCategory(id, { name });
                    const category = DataManager.state.categories.find(c => c.id === id);
                    if (category) category.name = updated.name; // Update DataManager state
                    UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
                    UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
                } catch (err) {
                    console.error('Failed to update category', err);
                    UIManager.showErrorMessage(err, 'updating category');
                }
            })
        );

        // Add event listeners for delete buttons
        list.querySelectorAll('.deleteCategoryBtn').forEach(btn =>
            btn.addEventListener('click', async e => {
                const li = e.target.closest('li');
                const id = parseInt(li.dataset.id);

                try {
                    await APIManager.deleteCategory(id);
                    DataManager.state.categories = DataManager.state.categories.filter(c => c.id !== id); // Update DataManager state
                    UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
                    this.renderCategoryList(); // Re-render the category list in the modal
                    UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
                } catch (err) {
                    console.error('Failed to delete category', err);
                    UIManager.showErrorMessage(err, 'deleting category');
                }
            })
        );
    },

    handleAddCategory: async function () {
        const name = this.elements.newCategoryNameInput.value.trim();
        if (!name) return;

        try {
            const category = await APIManager.addCategory({ name });
            DataManager.state.categories.push(category); // Add to DataManager state
            UIManager.refreshCategoryDropdown(); // Refresh the category dropdown in the task form
            this.renderCategoryList(); // Re-render the category list in the modal
            UIManager.renderCategories(DataManager.state.categories); // Re-render sidebar categories
            this.elements.newCategoryNameInput.value = ''; // Clear input field
        } catch (err) {
            console.error('Failed to add category', err);
            UIManager.showErrorMessage(err, 'adding category');
        }
    },

    hideCategoryForm: function () {
        this.elements.categoryModal.style.display = 'none';
    },
};