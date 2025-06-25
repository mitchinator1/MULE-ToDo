import { DataManager } from './DataManager.js';
import { TaskManager } from './TaskManager.js';
import { ModalManager } from './ModalManager.js';

const RECURRING_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recurring-svg"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;

// This object is responsible for creating, updating, and managing interactions
// for individual task elements in the DOM.
export const TaskRenderer = {
	UIManager: null,

	setUIManager(manager) {
		this.UIManager = manager;
	},

	createTaskElement: function (task) {
		const recurringData = (typeof task.recurring === 'object') ? task.recurring :
			(typeof task.recurring === 'string' ? JSON.parse(task.recurring || '{}') : {});

		const taskData = {
			id: task.id,
			title: task.title || 'Untitled Task',
			description: task.description || '',
			dueDate: task.dueDate || '',
			status: task.status || 'Not Started',
			priority: task.priority || 'Medium',
			categoryId: task.categoryId || null,
			recurring: recurringData,
		};

		const taskItem = document.createElement('div');
		taskItem.className = 'task-item';
		taskItem.dataset.taskId = taskData.id;
		// Apply 'completed' class if task is completed
		if (taskData.status === 'Completed') {
			taskItem.classList.add('completed');
		}

		// --- 1. Task Summary (Always Visible) ---
		const summary = document.createElement('div');
		summary.className = 'task-summary';

		// Checkbox for completion
		const checkboxContainer = document.createElement('div');
		checkboxContainer.className = 'task-checkbox-container';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'task-checkbox';
		checkbox.checked = taskData.status === 'Completed';
		checkbox.addEventListener('change', (e) => {
			TaskManager.updateTaskStatus(e, taskData.id, e.target.checked ? 'Completed' : 'Not Started');
		});
		checkboxContainer.appendChild(checkbox);
		summary.appendChild(checkboxContainer);

		const titleContainer = document.createElement('div');
		titleContainer.className = 'title-container';
		const titleSpan = document.createElement('span');
		titleSpan.className = 'task-title';
		titleSpan.textContent = taskData.title;
		titleSpan.addEventListener('click', (e) => this.editTaskTitle(e, taskData.id));
		titleContainer.appendChild(titleSpan);
		const titleInput = document.createElement('input');
		titleInput.className = 'title-edit';
		titleInput.style.display = 'none';
		titleInput.value = taskData.title;
		titleInput.addEventListener('blur', (e) => TaskManager.updateTitle(e, taskData.id));
		titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') this.finishTitleEdit(titleContainer); });
		titleContainer.appendChild(titleInput);
		summary.appendChild(titleContainer);

		const summaryMeta = document.createElement('div');
		summaryMeta.className = 'task-summary-meta';

		// Recurring icon (if applicable)
		if (taskData.recurring && Object.keys(taskData.recurring).length > 0) {
			const recurringIndicator = document.createElement('span');
			recurringIndicator.className = 'recurring-indicator';
			recurringIndicator.innerHTML = RECURRING_ICON_SVG;
			recurringIndicator.title = this.UIManager.getRecurringDescription(taskData.recurring);
			recurringIndicator.dataset.recurring = JSON.stringify(taskData.recurring); // Store raw data for modal
			recurringIndicator.addEventListener('click', (e) => ModalManager.showRecurringEditForm(taskData.id, e));
			summaryMeta.appendChild(recurringIndicator);
		}

		// Due Date
		const dueContainer = document.createElement('span');
		dueContainer.className = 'meta-item due-date-container';
		const dueValue = document.createElement('span');
		dueValue.className = 'meta-value due-date';
		dueValue.dataset.rawDate = taskData.dueDate || ''; // Store raw date for date input
		dueValue.textContent = this.UIManager.formatDateForDisplay(taskData.dueDate); // Display formatted date
		dueValue.addEventListener('click', (e) => this.toggleDueDateDropdown(e, taskData.id));
		dueContainer.appendChild(dueValue);
		const dueDropdown = document.createElement('div');
		dueDropdown.className = 'date-picker-dropdown';
		dueDropdown.style.display = 'none';
		const datePickerHeader = document.createElement('div');
		datePickerHeader.className = 'date-picker-header';
		const clear = document.createElement('span');
		clear.className = 'clear-date';
		clear.textContent = 'Clear';
		clear.addEventListener('click', (e) => this.clearDueDate(e, taskData.id));
		datePickerHeader.appendChild(clear);
		const quickDates = document.createElement('span');
		quickDates.className = 'quick-dates';
		['today', 'tomorrow', 'nextWeek'].forEach(option => {
			const span = document.createElement('span');
			span.textContent = option.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase());
			span.addEventListener('click', (e) => this.setQuickDate(e, taskData.id, option));
			quickDates.appendChild(span);
		});
		datePickerHeader.appendChild(quickDates);
		dueDropdown.appendChild(datePickerHeader);
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.className = 'date-input';
		dateInput.value = taskData.dueDate ? taskData.dueDate.split('T')[0] : ''; // Date input always needs YYYY-MM-DD
		dateInput.addEventListener('change', (e) => TaskManager.updateDueDate(e, taskData.id));
		dueDropdown.appendChild(dateInput);
		dueContainer.appendChild(dueDropdown);
		summaryMeta.appendChild(dueContainer);

		// Priority
		const priorityContainer = document.createElement('div');
		priorityContainer.className = 'priority-container';
		const priorityDisplay = document.createElement('div');
		priorityDisplay.className = `priority priority-${taskData.priority}`;
		priorityDisplay.textContent = taskData.priority; // Display priority text
		priorityDisplay.addEventListener('click', (e) => this.togglePriorityDropdown(e, taskData.id));
		priorityContainer.appendChild(priorityDisplay);
		const priorityDropdown = document.createElement('div');
		priorityDropdown.className = 'priority-dropdown';
		priorityDropdown.style.display = 'none';
		['Low', 'Medium', 'High'].forEach(level => {
			const option = document.createElement('div');
			option.className = `priority-option priority-${level}`;
			option.textContent = level;
			option.addEventListener('click', (e) => TaskManager.updatePriority(e, taskData.id, level));
			priorityDropdown.appendChild(option);
		});
		priorityContainer.appendChild(priorityDropdown);
		summaryMeta.appendChild(priorityContainer);
		summary.appendChild(summaryMeta);
		taskItem.appendChild(summary);

		// --- 2. Task Details (Collapsible) ---
		const detailsCollapsible = document.createElement('div');
		detailsCollapsible.className = 'task-details-collapsible';

		// Description
		const descContainer = document.createElement('div');
		descContainer.className = 'description-container';
		const desc = document.createElement('div');
		desc.className = 'description';
		desc.innerHTML = taskData.description || '<span class="placeholder">Add description...</span>';
		desc.addEventListener('click', (e) => this.editTaskDescription(e, taskData.id));
		descContainer.appendChild(desc);
		const descEdit = document.createElement('textarea');
		descEdit.className = 'description-edit';
		descEdit.style.display = 'none';
		descEdit.value = taskData.description;
		descEdit.addEventListener('blur', (e) => TaskManager.updateDescription(e, taskData.id));
		descEdit.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.finishDescriptionEdit(descContainer); });
		descContainer.appendChild(descEdit);
		detailsCollapsible.appendChild(descContainer);

		// Extended Meta Section
		const extendedMeta = document.createElement('div');
		extendedMeta.className = 'task-meta-extended';
		const category = DataManager.state.categories.find(c => c.id === taskData.categoryId)?.name || 'None';
		extendedMeta.innerHTML = `
			<div class="meta-row"><span class="meta-label">Category:</span> <span class="meta-value">${category}</span></div>
			<div class="meta-row"><span class="meta-label">Status:</span> <span class="meta-value status">${taskData.status}</span></div>
		`;
		detailsCollapsible.appendChild(extendedMeta);

		// Subtask Expander
		const expand = document.createElement('div');
		expand.className = `task-expand-indicator ${task.hasSubtasks ? '' : 'hidden'}`;
		expand.innerHTML = '<span>Subtasks</span>';
		expand.addEventListener('click', (e) => this.UIManager.toggleSubtasks(taskData.id, e));
		detailsCollapsible.appendChild(expand);

		taskItem.appendChild(detailsCollapsible);

		// --- 3. Task Actions Footer ---
		const actionsFooter = document.createElement('div');
		actionsFooter.className = 'task-actions-footer';

		// Details Toggle Button
		const detailsToggleBtn = document.createElement('button');
		detailsToggleBtn.className = 'details-toggle-btn';
		detailsToggleBtn.textContent = 'Details';
		actionsFooter.appendChild(detailsToggleBtn);

		const seperator = document.createElement('span');
		seperator.className = 'seperator';
		seperator.textContent = '|';
		actionsFooter.appendChild(seperator);

		// "Add Subtask" button
		const addBtn = document.createElement('button');
		addBtn.className = 'btn';
		addBtn.textContent = 'Add Subtask'; // Text for the button
		addBtn.addEventListener('click', () => ModalManager.showTaskForm(taskData.id));
		actionsFooter.appendChild(addBtn);

		// "Delete" button
		const delBtn = document.createElement('button');
		delBtn.className = 'btn';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => TaskManager.deleteTask(taskData.id));
		actionsFooter.appendChild(delBtn);
		taskItem.appendChild(actionsFooter);

		// Event listener for the new toggle
		detailsToggleBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const isCollapsing = detailsCollapsible.classList.contains('expanded');

			if (isCollapsing) {
				detailsCollapsible.style.maxHeight = detailsCollapsible.scrollHeight + 'px';
				detailsCollapsible.offsetHeight;

				detailsCollapsible.classList.remove('expanded');
				detailsToggleBtn.textContent = 'Details';
				detailsCollapsible.style.maxHeight = '0px';
			} else {
				detailsCollapsible.classList.add('expanded');
				detailsToggleBtn.textContent = 'Hide';
				detailsCollapsible.style.maxHeight = detailsCollapsible.scrollHeight + 'px';
			}
			setTimeout(() => this.UIManager.updateParentContainers(detailsCollapsible), 0);
		});

		return taskItem;
	},

	updateTaskElement: function (taskId, updatedTask) {
		const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
		if (!taskElement) return;

		// Update title
		const titleSpan = taskElement.querySelector('.task-title');
		const titleInput = taskElement.querySelector('.title-edit');
		if (titleSpan) {
			titleSpan.textContent = updatedTask.title || 'Untitled Task';
			titleSpan.style.visibility = 'visible';
			if (titleInput) {
				titleInput.value = updatedTask.title || 'Untitled Task';
				titleInput.style.display = 'none';
			}
		}
		// Update description
		const descriptionDiv = taskElement.querySelector('.description');
		const descriptionTextarea = taskElement.querySelector('.description-edit');
		if (descriptionDiv) {
			const description = updatedTask.description || '';
			descriptionDiv.innerHTML = description || '<span class="placeholder">Add description...</span>';
			descriptionDiv.style.visibility = 'visible';
			if (descriptionTextarea) {
				descriptionTextarea.value = description;
				descriptionTextarea.style.display = 'none';
			}
		}
		// Update status
		const statusElement = taskElement.querySelector('.status');
		if (statusElement) {
			statusElement.textContent = updatedTask.status || 'Not Started';
		}

		// Update completed status
		const taskItemElement = taskElement.querySelector('.task-item');
		if (taskItemElement) {
			taskItemElement.classList.toggle('completed', updatedTask.status === 'Completed');
		}
		const checkbox = taskElement.querySelector('.task-checkbox');
		if (checkbox) {
			checkbox.checked = updatedTask.status === 'Completed';
		}

		// Update due date
		this.updateDueDateDisplay(taskId, updatedTask.dueDate);

		// Update recurring indicator
		let recurringIndicator = taskElement.querySelector('.recurring-indicator');

		if (updatedTask.recurring && typeof updatedTask.recurring === 'object' && Object.keys(updatedTask.recurring).length > 0) {
			// If indicator doesn't exist, create it
			if (!recurringIndicator) {
				recurringIndicator = document.createElement('span');
				recurringIndicator.className = 'recurring-indicator';
				recurringIndicator.innerHTML = RECURRING_ICON_SVG;
				recurringIndicator.addEventListener('click', (e) => ModalManager.showRecurringEditForm(taskId, e));

				const summaryMeta = taskElement.querySelector('.task-summary-meta');
				if (summaryMeta) {
					const dueContainer = summaryMeta.querySelector('.due-date-container');
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
	},

	editTaskTitle: function (event, taskId) {
		const titleSpan = event.currentTarget;
		const container = titleSpan.closest('.title-container');
		const input = container.querySelector('.title-edit');
		titleSpan.style.visibility = 'hidden';
		input.style.display = 'block';
		input.focus();
	},

	finishTitleEdit: function (container) {
		const titleSpan = container.querySelector('.task-title');
		const input = container.querySelector('.title-edit');

		input.style.display = 'none';
		titleSpan.style.visibility = 'visible';
	},

	editTaskDescription: function (event, taskId) {
		const descriptionDiv = event.currentTarget;
		const container = descriptionDiv.closest('.description-container');
		const textarea = container.querySelector('.description-edit');
		textarea.style.height = `${descriptionDiv.offsetHeight}px`;
		descriptionDiv.style.visibility = 'hidden';
		textarea.style.display = 'block';
		textarea.focus();
		textarea.addEventListener('input', function () {
			this.style.height = 'auto';
			this.style.height = `${this.scrollHeight}px`;
		});
	},

	finishDescriptionEdit: function (container) {
		const descriptionDiv = container.querySelector('.description');
		const textarea = container.querySelector('.description-edit');
		textarea.style.display = 'none';
		descriptionDiv.style.visibility = 'visible';
	},

	toggleDueDateDropdown: function (event, taskId) {
		const container = event.currentTarget.closest('.meta-item');
		const dropdown = container.querySelector('.date-picker-dropdown');
		document.querySelectorAll('.date-picker-dropdown').forEach(d => {
			if (d !== dropdown) d.style.display = 'none';
		});

		dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
		if (dropdown.style.display === 'flex') {
			const closeDropdown = (e) => {
				if (!container.contains(e.target)) {
					dropdown.style.display = 'none';
					document.removeEventListener('click', closeDropdown);
				}
			};
			setTimeout(() => document.addEventListener('click', closeDropdown), 0);
		}
	},

	setQuickDate: function (event, taskId, type) {
		event.stopPropagation();
		const now = new Date();
		const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		let date;
		switch (type) {
			case 'today': date = today; break;
			case 'tomorrow': date = new Date(today); date.setUTCDate(today.getUTCDate() + 1); break;
			case 'nextWeek': date = new Date(today); date.setUTCDate(today.getUTCDate() + 7); break;
		}
		const formattedDate = date.toISOString().split('T')[0];
		this.updateDueDateDisplay(taskId, formattedDate);
		TaskManager.updateTaskField(taskId, 'dueDate', formattedDate);
	},

	clearDueDate: function (event, taskId) {
		event.stopPropagation();
		this.updateDueDateDisplay(taskId, '');
		TaskManager.updateTaskField(taskId, 'dueDate', '');
	},

	updateDueDateDisplay: function (taskId, newDate) {
		const container = document.querySelector(`.task-container[data-task-id="${taskId}"] .due-date-container`);
		if (!container) return;

		const dueDate = container.querySelector('.due-date');
		const dropdown = container.querySelector('.date-picker-dropdown');
		const dateInput = dropdown.querySelector('.date-input');

		dueDate.setAttribute('data-raw-date', newDate);
		dueDate.textContent = this.UIManager.formatDateForDisplay(newDate);
		dateInput.value = newDate;
		dropdown.style.display = 'none';
	},

	togglePriorityDropdown: function (event, taskId) {
		event.stopPropagation();
		const container = event.currentTarget.closest('.task-container');
		const dropdown = container.querySelector('.priority-dropdown');

		if (!dropdown.style.display) dropdown.style.display = 'none';

		document.querySelectorAll('.priority-dropdown').forEach(d => {
			if (d !== dropdown) d.style.display = 'none';
		});

		dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';

		if (dropdown.style.display === 'block') {
			const closeDropdown = (e) => {
				if (!container.contains(e.target)) {
					dropdown.style.display = 'none';
					document.removeEventListener('click', closeDropdown);
				}
			};
			setTimeout(() => document.addEventListener('click', closeDropdown), 0);
		}
	},

	updatePriorityDisplay: function (taskId, priority) {
		const container = document.querySelector(`.task-container[data-task-id="${taskId}"] .priority-container`);
		if (!container) return;

		const priorityElement = container.querySelector('.priority');
		const dropdown = container.querySelector('.priority-dropdown');

		if (priorityElement) {
			priorityElement.textContent = priority;
			priorityElement.className = `priority priority-${priority}`;
		}
		if (dropdown) {
			dropdown.style.display = 'none';
		}
	},
};