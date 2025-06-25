import { DataManager } from './DataManager.js';
import { TaskManager } from './TaskManager.js';
import { Snackbar, Throbber } from './UIHelpers.js';

export const UIManager = {
	elements: {},

	init: function () {
		// Initialize all element references
		this.elements = {
			taskList: document.getElementById('taskList'),
			taskForm: document.getElementById('taskForm'),
			formElement: document.getElementById('taskFormElement'),
			sidebar: document.getElementById('sidebar'),
			filterContainer: document.getElementById('filterContainer'),
			addTaskButton: document.getElementById('addTaskButton')
		};
		// Verify critical elements exist
		const missingElements = Object.entries(this.elements)
			.filter(([key, element]) => !element)
			.map(([key]) => key);
		if (missingElements.length > 0) {
			throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
		}

		this.setupEventListeners();
	},

	setupEventListeners: function () {
		document.getElementById('recurringModalClose').addEventListener('click', this.hideRecurringEditForm);
		document.getElementById('taskModalClose').addEventListener('click', this.hideTaskForm.bind(this));
		document.getElementById('toggleFilters').addEventListener('click', this.toggleFilters.bind(this));

		// Date Picker controls
		document.getElementById('openDueDatePicker').addEventListener('click', (e) => this.editTaskDueDate(e, 'modal'));
		document.getElementById('quickDateClear').addEventListener('click', (e) => this.clearDueDate(e, 'modal'));
		document.getElementById('quickDateToday').addEventListener('click', (e) => this.setQuickDate(e, 'modal', 'today'));
		document.getElementById('quickDateTomorrow').addEventListener('click', (e) => this.setQuickDate(e, 'modal', 'tomorrow'));
		document.getElementById('quickDateNextWeek').addEventListener('click', (e) => this.setQuickDate(e, 'modal', 'nextWeek'));

		document.getElementById('openPriorityPicker').addEventListener('click', (e) => this.togglePriorityDropdown(e, 'modal'));
	},

	setupRecurringControls: function (handlers) {
		const patternSelect = document.getElementById('recurringPattern');
		const recurringOptions = document.querySelector('.recurring-options');
		const customRepeatDiv = document.querySelector('.custom-repeat');
		const endTypeRadios = document.getElementsByName('recurringEnd');
		const occurenceCount = document.getElementById('occurenceCount');
		const endDate = document.getElementById('endDate');
		// Toggle recurring and custom options
		patternSelect.addEventListener('change', (e) => {
			const showRecurringOptions = e.target.value !== 'none';
			recurringOptions.style.display = showRecurringOptions ? 'block' : 'none';
			customRepeatDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
		});
		// Handle end date options
		endTypeRadios.forEach(radio => {
			radio.addEventListener('change', (e) => {
				occurenceCount.disabled = e.target.value !== 'after';
				endDate.disabled = e.target.value !== 'on';
				// Enable/disable the associated input
				if (e.target.value === 'after') {
					occurenceCount.disabled = false;
					occurenceCount.focus();
				} else if (e.target.value === 'on') {
					endDate.disabled = false;
					endDate.focus();
				}
			});
		});
		if (this.elements.recurringEditForm) {
			this.elements.recurringEditForm.addEventListener('submit', (e) => {
				e.preventDefault();
				if (handlers && handlers.onRecurringEditSubmit) {
					handlers.onRecurringEditSubmit(e);
				}
			});
		}

	},

	setupRecurringEditControls: function (handlers) {
		const patternSelect = document.getElementById('editRecurringPattern');
		const recurringOptionsDiv = document.querySelector('#recurringEditModal	.recurring-options');
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
				document.querySelector('.custom-repeat').style.display = val === 'custom' ? 'block' : 'none';
				document.querySelector('.weekly-days').style.display = val === 'weekly' || val === 'weekday' ? 'block' : 'none';
				document.querySelector('.monthly-day').style.display = val === 'monthly' ? 'block' : 'none';
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

	showThrobber: function (context) {
		Throbber.show(context, {
			mode: 'inline',
			position: 'bottom-right',
			animation: 'bounce',
			dotCount: 4,
			message: `${context}...`
		});
	},

	hideThrobber: function (context) {
		Throbber.hide(context);
	},

	showMessage: function (message, type = 'default') {
		Snackbar.show(message, {
			type: type
		});
	},

	showErrorMessage: function (message, context) {
		Snackbar.show(`Error ${context.toLowerCase()}: ${message}`, {
			type: 'error'
		});
		console.error(`Error ${context.toLowerCase()}:`, message);
	},

	showSuccessMessage: function (message) {
		Snackbar.show(message, {
			type: 'success'
		});
	},

	showTaskForm: function (parentId = null) {
		const formTitle = document.querySelector('#taskForm h3');
		const submitButton = document.getElementById('taskFormSubmit');
		const parentIdField = document.getElementById('parentTaskId');
		const taskIdField = document.getElementById('taskId');
		// Reset form
		this.hideTaskForm();
		// Clear ID fields
		if (taskIdField)
			taskIdField.value = '';
		if (parentIdField)
			parentIdField.value = parentId || '';
		// Set default priority
		const modalPriorityDisplay = document.getElementById('modalPriorityDisplay');
		const priorityHidden = document.getElementById('priorityHidden');
		const priorityElement = document.querySelector('#taskForm .priority');
		if (modalPriorityDisplay)
			modalPriorityDisplay.textContent = 'Medium';
		if (priorityHidden)
			priorityHidden.value = 'Medium';
		if (priorityElement) {
			priorityElement.className = 'priority priority-Medium';
		}
		// Update form title and submit button text
		if (formTitle) {
			formTitle.textContent = parentId ? 'Add Subtask' : 'New Task';
		}
		if (submitButton) {
			submitButton.textContent = parentId ? 'Add Subtask' : 'Add Task';

		}
		// Show the modal
		this.elements.taskForm.style.display = 'block';
		// Focus on task name input
		const taskNameInput = document.getElementById('taskName');
		if (taskNameInput) {
			taskNameInput.focus();
		}
	},

	hideTaskForm: function () {
		this.elements.taskForm.style.display = 'none';
		this.elements.formElement.reset();
		// Reset priority display and hidden input
		const defaultPriority = 'Medium';
		document.getElementById('modalPriorityDisplay').textContent = defaultPriority;
		document.getElementById('priorityHidden').value = defaultPriority;
		const priorityElement = this.elements.taskForm.querySelector('.priority');
		if (priorityElement) {
			priorityElement.className = `priority priority-${defaultPriority}`;
		}
		// Reset due date
		const dueDateElement = document.getElementById('dueDate');
		if (dueDateElement)
			dueDateElement.value = '';
		const dueDateDisplay = document.getElementById('modalDueDateDisplay');
		if (dueDateDisplay)
			dueDateDisplay.textContent = 'None';
		// Reset recurring options
		const recurringPattern = document.getElementById('recurringPattern');
		if (recurringPattern)
			recurringPattern.value = 'none';
		const recurringOptions = document.querySelector('.recurring-options');
		if (recurringOptions)
			recurringOptions.style.display = 'none';
	},

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

			if (rawData) {
				recurringData = JSON.parse(rawData);
			} else {
				recurringData = {};
			}
		} catch (e) {
			console.error('Error parsing recurring data:', e);
			recurringData = {};
		}

		this.populateRecurringEditForm(recurringData);

		document.getElementById('recurringEditModal').style.display = 'block';
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
		const weekdayCheckboxes = document.querySelectorAll('.weekday-checkbox');

		if (!recurringData || !recurringData.frequency || recurringData.frequency === 'none') {
			// Set defaults to "does not repeat"
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
			// Uncheck all weekdays
			weekdayCheckboxes.forEach(cb => cb.checked = false);
			byMonthDayInput.value = '';
			// return;
		}

		patternSelect.value = recurringData.frequency;

		// Show/hide controls based on pattern
		customRepeatDiv.style.display = recurringData.frequency === 'custom' ? 'block' : 'none';
		weeklyDaysDiv.style.display = (recurringData.frequency === 'weekly' || recurringData.frequency === 'weekday') ? 'block' : 'none';
		monthlyDayDiv.style.display = recurringData.frequency === 'monthly' ? 'block' : 'none';

		// Handle custom interval
		if (recurringData.frequency === 'custom' && recurringData.interval) {
			document.getElementById('editCustomInterval').value = recurringData.interval.value || 1;
			document.getElementById('editCustomUnit').value = recurringData.interval.unit || 'days';
		}

		// Handle weekly days
		if (recurringData.by_day) {
			// by_day is string like "MO,TU,WE"
			const days = recurringData.by_day.split(',');
			weekdayCheckboxes.forEach(cb => {
				cb.checked = days.includes(cb.value);
			});
		} else {
			weekdayCheckboxes.forEach(cb => cb.checked = false);
		}

		// Handle monthly day
		if (recurringData.by_month_day) {
			byMonthDayInput.value = recurringData.by_month_day;
		} else {
			byMonthDayInput.value = '';
		}

		// Handle end type and values
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
	},

	hideRecurringEditForm: function () {
		document.getElementById('recurringEditModal').style.display = 'none';
	},

	createTaskElement: function (task) {
		let recurringData = {};

		if (task.recurring) {
			if (typeof task.recurring === 'string') {
				try {
				recurringData = JSON.parse(task.recurring);
				} catch {
				recurringData = {};
				}
			} else if (typeof task.recurring === 'object') {
				recurringData = task.recurring;
			}
		}

		const taskData = {
			id: task.id,
			title: task.title || 'Untitled Task',
			description: task.description || '',
			dueDate: task.dueDate || '',
			status: task.status || 'Not Started',
			priority: task.priority || 'Low',
			progress: task.progress || 0,
			category: task.category || '',
			recurring: recurringData,
		};

		const taskItem = document.createElement('div');
		taskItem.className = 'task-item';
		taskItem.dataset.taskId = taskData.id;

		// Expand Indicator (for subtasks)
		const expand = document.createElement('div');
		expand.className = `task-expand-indicator ${task.hasSubtasks ? '' : 'hidden'}`;
		expand.addEventListener('click', (e) => UIManager.toggleSubtasks(taskData.id, e));
		taskItem.appendChild(expand);

		// Task Content
		const content = document.createElement('div');
		content.className = 'task-content';

		// Header
		const header = document.createElement('div');
		header.className = 'task-header';

		// Recurring icon
		if (taskData.recurring && typeof taskData.recurring === 'object') {
			const recurring = document.createElement('span');
			recurring.className = 'recurring-indicator';
			recurring.textContent = '🔁';
			recurring.title = UIManager.getRecurringDescription(taskData.recurring);
			recurring.dataset.recurring = JSON.stringify(taskData.recurring);
			recurring.addEventListener('click', (e) => UIManager.showRecurringEditForm(taskData.id, e));
			header.appendChild(recurring);
		}

		// Title container
		const titleContainer = document.createElement('div');
		titleContainer.className = 'title-container';

		const titleSpan = document.createElement('span');
		titleSpan.className = 'task-title';
		titleSpan.textContent = taskData.title;
		titleSpan.addEventListener('click', (e) => UIManager.editTaskTitle(e, taskData.id));
		titleContainer.appendChild(titleSpan);

		const titleInput = document.createElement('input');
		titleInput.className = 'title-edit';
		titleInput.style.display = 'none';
		titleInput.value = taskData.title;
		titleInput.addEventListener('blur', (e) => TaskManager.updateTitle(e, taskData.id));
		titleInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') e.target.blur();
			if (e.key === 'Escape') UIManager.finishTitleEdit(titleContainer);
		});
		titleContainer.appendChild(titleInput);

		header.appendChild(titleContainer);

		// Task Meta (due date, status, progress)
		const details = document.createElement('div');
		details.className = 'task-details';

		const meta = document.createElement('div');
		meta.className = 'task-meta';

		// Due Date
		const dueContainer = document.createElement('span');
		dueContainer.className = 'meta-item due-date-container';

		const dueLabel = document.createElement('span');
		dueLabel.className = 'meta-label';
		dueLabel.textContent = 'Due:';
		dueContainer.appendChild(dueLabel);

		const dueValue = document.createElement('span');
		dueValue.className = 'meta-value due-date';
		dueValue.dataset.rawDate = taskData.dueDate || '';
		dueValue.textContent = taskData.dueDate ? taskData.dueDate.split('T')[0] : 'None';
		dueValue.addEventListener('click', (e) => UIManager.editTaskDueDate(e, taskData.id));
		dueContainer.appendChild(dueValue);

		const dueDropdown = document.createElement('div');
		dueDropdown.className = 'date-picker-dropdown';
		dueDropdown.style.display = 'none';

		// Header
		const datePickerHeader = document.createElement('div');
		datePickerHeader.className = 'date-picker-header';

		const clear = document.createElement('span');
		clear.className = 'clear-date';
		clear.textContent = 'Clear';
		clear.addEventListener('click', (e) => UIManager.clearDueDate(e, taskData.id));
		datePickerHeader.appendChild(clear);

		// Quick options
		const quickDates = document.createElement('span');
		quickDates.className = 'quick-dates';
		['today', 'tomorrow', 'nextWeek'].forEach(option => {
			const span = document.createElement('span');
			span.textContent = option
				.replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase words
				.replace(/^./, s => s.toUpperCase()); // Capitalize first letter
			span.addEventListener('click', (e) => UIManager.setQuickDate(e, taskData.id, option));
			quickDates.appendChild(span);
		});
		datePickerHeader.appendChild(quickDates);
		dueDropdown.appendChild(datePickerHeader);

		// Date input
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.className = 'date-input';
		dateInput.value = taskData.dueDate ? taskData.dueDate.split('T')[0] : '';
		dateInput.addEventListener('change', (e) => TaskManager.updateDueDate(e, taskData.id));
		dateInput.addEventListener('click', (e) => e.stopPropagation());
		dueDropdown.appendChild(dateInput);

		dueContainer.appendChild(dueDropdown);

		meta.appendChild(dueContainer);

		// Status
		const status = document.createElement('span');
		status.className = 'meta-item';
		status.innerHTML = `<span class="meta-label">Status:</span><span class="meta-value status">${taskData.status}</span>`;
		meta.appendChild(status);

		// Progress
		const progress = document.createElement('span');
		progress.className = 'meta-item';
		progress.innerHTML = `<span class="meta-label">Complete:</span><span class="meta-value progress">${taskData.progress}%</span>`;
		meta.appendChild(progress);

		details.appendChild(meta);

		// Progress Bar
		const bar = document.createElement('div');
		bar.className = 'progress-bar';
		const fill = document.createElement('div');
		fill.className = 'progress';
		fill.style.width = `${taskData.progress}%`;
		bar.appendChild(fill);
		details.appendChild(bar);

		header.appendChild(details);

		// Priority dropdown
		const priorityContainer = document.createElement('div');
		priorityContainer.className = 'priority-container';

		const priorityDisplay = document.createElement('div');
		priorityDisplay.className = `priority priority-${taskData.priority}`;
		priorityDisplay.textContent = taskData.priority;
		priorityDisplay.addEventListener('click', (e) => UIManager.togglePriorityDropdown(e, taskData.id));
		priorityContainer.appendChild(priorityDisplay);

		const dropdown = document.createElement('div');
		dropdown.className = 'priority-dropdown';
		dropdown.style.display = 'none';
		['Low', 'Medium', 'High'].forEach(level => {
			const option = document.createElement('div');
			option.className = `priority-option priority-${level}`;
			option.textContent = level;
			option.addEventListener('click', (e) => TaskManager.updatePriority(e, taskData.id, level));
			dropdown.appendChild(option);
		});
		priorityContainer.appendChild(dropdown);

		header.appendChild(priorityContainer);
		content.appendChild(header);

		// Description
		const descContainer = document.createElement('div');
		descContainer.className = 'description-container';

		const desc = document.createElement('div');
		desc.className = 'description';
		desc.innerHTML = taskData.description || '<span class="placeholder">Add description...</span>';
		desc.addEventListener('click', (e) => UIManager.editTaskDescription(e, taskData.id));
		descContainer.appendChild(desc);

		const descEdit = document.createElement('textarea');
		descEdit.className = 'description-edit';
		descEdit.style.display = 'none';
		descEdit.value = taskData.description;
		descEdit.addEventListener('blur', (e) => TaskManager.updateDescription(e, taskData.id));
		descEdit.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') UIManager.finishDescriptionEdit(descContainer);
		});
		descContainer.appendChild(descEdit);

		content.appendChild(descContainer);
		taskItem.appendChild(content);

		// Actions
		const actions = document.createElement('div');
		actions.className = 'task-actions';

		const addBtn = document.createElement('button');
		addBtn.className = 'btn btn-info btn-sm';
		addBtn.textContent = 'Add';
		addBtn.addEventListener('click', () => UIManager.showTaskForm(taskData.id));
		actions.appendChild(addBtn);

		const doneBtn = document.createElement('button');
		doneBtn.className = 'btn btn-success btn-sm';
		doneBtn.textContent = 'Done';
		doneBtn.addEventListener('click', (e) => TaskManager.updateTaskStatus(e, taskData.id, 'Completed'));
		actions.appendChild(doneBtn);

		const delBtn = document.createElement('button');
		delBtn.className = 'btn btn-delete btn-sm';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => TaskManager.deleteTask(taskData.id));
		actions.appendChild(delBtn);

		taskItem.appendChild(actions);
		return taskItem;
	},

	toggleSubtasks: function (taskId, event) {
		if (event) event.stopPropagation();

		const subtasksContainer = document.getElementById(`subtasks-${taskId}`);
		const indicator = event.target.closest('.task-expand-indicator');
		if (subtasksContainer && indicator) {
			const isExpanding = !subtasksContainer.classList.contains('expanded');
			if (isExpanding) {
				// Set initial height before adding expanded class
				const height = this.calculateContainerHeight(subtasksContainer);
				subtasksContainer.style.maxHeight = '0px'; // Ensure we start from 0
				// Force a reflow
				subtasksContainer.offsetHeight;
				// Add expanded class and set new height
				subtasksContainer.classList.add('expanded');
				indicator.classList.add('expanded');
				subtasksContainer.style.maxHeight = `${height}px`;
				// Update parent containers
				const parentContainer = subtasksContainer.parentElement.closest('.subtasks-container');
				if (parentContainer && parentContainer.classList.contains('expanded')) {
					const parentHeight = this.calculateContainerHeight(parentContainer);
					parentContainer.style.maxHeight = `${parentHeight}px`;
				}
			} else {
				// Collapsing
				subtasksContainer.style.maxHeight = '0px';
				subtasksContainer.classList.remove('expanded');
				indicator.classList.remove('expanded');
				// Update parent container height
				const parentContainer = subtasksContainer.parentElement.closest('.subtasks-container');
				if (parentContainer && parentContainer.classList.contains('expanded')) {
					const parentHeight = this.calculateContainerHeight(parentContainer);
					parentContainer.style.maxHeight = `${parentHeight}px`;
				}
			}
		}
	},

	updateTaskElement: function (taskId, updatedTask) {
		const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
		if (!taskElement) return;

		// Update title
		const titleSpan = taskElement.querySelector('.task-title');
		const titleInput = taskElement.querySelector('.title-edit');
		if (titleSpan) {
			titleSpan.textContent = updatedTask.title || 'Untitled Task';
			titleSpan.style.display = 'inline';
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
			descriptionDiv.style.display = 'block';
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
		// Update progress
		const progressElement = taskElement.querySelector('.progress');
		if (progressElement) {
			progressElement.textContent = `${updatedTask.progress || 0}%`;
		}
		const progressBarElement = taskElement.querySelector('.progress-bar .progress');
		if (progressBarElement) {
			progressBarElement.style.width = `${updatedTask.progress || 0}%`;
		}

		// Update completed status
		const taskItemElement = taskElement.querySelector('.task-item');
		if (taskItemElement) {
			taskItemElement.classList.toggle('completed', updatedTask.status === 'Completed');
		}
		const completeButton = taskElement.querySelector('.btn-success');
		if (completeButton) {
			completeButton.textContent = updatedTask.status === 'Completed' ? 'Completed' : 'Done';
			completeButton.disabled = updatedTask.status === 'Completed';
		}
		// Update due date
		const dueDateElement = taskElement.querySelector('.due-date');
		if (dueDateElement && updatedTask.dueDate) {
			let formattedDate = updatedTask.dueDate;
			// Check if dueDate is a Date object
			if (updatedTask.dueDate instanceof Date) {
				formattedDate = updatedTask.dueDate.toISOString().split('T')[0];
			} else if (typeof updatedTask.dueDate === 'string') {
				// If it's already a string, ensure it's in YYYY-MM-DD format
				formattedDate = updatedTask.dueDate.split('T')[0];
			}
			dueDateElement.textContent = formattedDate;
			dueDateElement.setAttribute('data-raw-date', formattedDate);
		}
		// Update recurring indicator
		const recurringIndicator = taskElement.querySelector('.recurring-indicator');

		if (updatedTask.recurring && typeof updatedTask.recurring === 'object' && Object.keys(updatedTask.recurring).length > 0) {
			// If indicator doesn't exist, create it
			if (!recurringIndicator) {
				recurringIndicator = document.createElement('span');
				recurringIndicator.className = 'recurring-indicator';
				recurringIndicator.textContent = '🔁';
				recurringIndicator.onclick = (event) => TaskManager.editRecurringPattern(taskId, event);

				const taskHeader = taskElement.querySelector('.task-header');
				if (taskHeader) {
					taskHeader.insertBefore(recurringIndicator, taskHeader.firstChild);
				}
			}

			// Update recurring indicator data
			const recurringData = JSON.stringify(updatedTask.recurring);
			recurringIndicator.setAttribute('data-recurring', recurringData);
			recurringIndicator.setAttribute('title', this.getRecurringDescription(updatedTask.recurring));

		} else if (recurringIndicator) {
			// Remove if no longer recurring
			recurringIndicator.remove();
		}
	},

	deleteTaskElement: function (taskId) {
		const taskElement = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
		if (!taskElement) return;

		taskElement.remove();
	},

	renderCategories: function (categories) {
		const categoryList = document.getElementById('categoryList');
		if (!categoryList) {
			console.error('Category list element not found');
			return;
		}
		categoryList.innerHTML = '';
		categories.forEach(category => {
			const categoryItem = document.createElement('div');
			categoryItem.className = 'category-item';
			categoryItem.innerHTML = `<span class="category-text">${category}</span>`;
			categoryItem.onclick = () => TaskManager.selectCategory(category);
			if (category === DataManager.state.currentCategory) {
				categoryItem.classList.add('active');
			}
			categoryList.appendChild(categoryItem);
		});
	},

	updateCategorySelection: function (category) {
		document.querySelectorAll('.category-item').forEach(item => {
			item.classList.toggle('active', item.textContent.trim() === category);
		});
	},

	setupSidebar: function () {
		const toggleButton = document.getElementById('toggleSidebar');
		const sidebar = document.getElementById('sidebar');

		toggleButton.onclick = () => {
			sidebar.classList.toggle('collapsed');
		};
	},

	renderTaskList: function (tasks) {
		if (!this.elements.taskList) {
			console.error('Task list element not found');
			return;
		}
		this.elements.taskList.innerHTML = '';
		// Create a map of tasks by their IDs
		const taskMap = new Map();
		tasks.forEach(task => {
			taskMap.set(task.id, {
				...task,
				hasSubtasks: false,
				expanded: false,
				level: 0
			});
		});
		// Mark tasks that have subtasks
		taskMap.forEach(task => {
			if (task.parentTaskId && taskMap.get(task.parentTaskId)) {
				const parentTask = taskMap.get(task.parentTaskId);
				parentTask.hasSubtasks = true;
				task.level = parentTask.level + 1;
			}
		});
		// First render all top-level tasks
		taskMap.forEach(task => {
			if (!task.parentTaskId) {
				const taskElement = document.createElement('div');
				taskElement.className = `task-container category-${task.category || 'none'}`;
				taskElement.setAttribute('data-task-id', task.id);
				taskElement.appendChild(this.createTaskElement(task));
				this.elements.taskList.appendChild(taskElement);

				// Render its subtasks
				this.renderSubtasks(task.id, taskMap, taskElement);
			}
		});
	},

	renderSubtasks: function (parentId, taskMap, parentElement) {
		// Create subtasks container if the parent has subtasks
		const parentTask = taskMap.get(parentId);
		if (!parentTask.hasSubtasks)
			return;
		const subtasksContainer = document.createElement('div');
		subtasksContainer.className = 'subtasks-container';
		subtasksContainer.id = `subtasks-${parentId}`;
		parentElement.appendChild(subtasksContainer);
		taskMap.forEach(task => {
			if (task.parentTaskId === parentId) {
				const taskElement = document.createElement('div');
				taskElement.className = `task-container category-${task.category || 'none'}`;
				taskElement.setAttribute('data-task-id', task.id);
				taskElement.appendChild(this.createTaskElement(task));
				subtasksContainer.appendChild(taskElement);
				// Recursively render any nested subtasks
				this.renderSubtasks(task.id, taskMap, taskElement);
			}
		});
	},

	calculateContainerHeight: function (container) {
		// Adding 1 and remove 1 on subtasks seems to even out, assuming due to borders.
		let totalHeight = 0;
		const containerStyle = window.getComputedStyle(container);
		const containerGap = parseFloat(containerStyle.gap) || 0;
		const containerMarginTop = parseFloat(containerStyle.marginTop) || 0;
		totalHeight =  + containerMarginTop;
		Array.from(container.children).forEach((child, index) => {
			const childStyle = window.getComputedStyle(child);

			totalHeight += child.offsetHeight; // + 1;
			if (index < container.children.length - 1)
				totalHeight += containerGap;
			const expandedSubtasks = child.querySelector('.subtasks-container.expanded');
			if (expandedSubtasks) {
				const expandedStyle = window.getComputedStyle(expandedSubtasks);
				const expandedHeight = expandedSubtasks.scrollHeight;
				totalHeight += expandedHeight - 1; // + containerGap;
			}
		});
		return Math.ceil(totalHeight + 1); // Round up to account for potential fractional pixels
	},

	updateParentContainers: function (container) {
		let parent = container.parentElement.closest('.subtasks-container');
		while (parent && parent.classList.contains('expanded')) {
			const parentHeight = this.calculateContainerHeight(parent);
			parent.style.maxHeight = `${parentHeight}px`;
			parent = parent.parentElement.closest('.subtasks-container');
		}
	},

	addTaskToUI: function (task) {
		const taskElement = document.createElement('div');
		taskElement.className = `task-container category-${task.category || 'none'}`;
		taskElement.setAttribute('data-task-id', task.id);
		taskElement.appendChild(this.createTaskElement(task));

		if (task.parentTaskId) {
			// This is a subtask
			const parentContainer =
				document.querySelector(`.task-container[data-task-id="${task.parentTaskId}"]`);
			if (parentContainer) {
				let subtasksContainer = parentContainer.querySelector('.subtasks-container');
				if (!subtasksContainer) {
					// Create subtasks container if it doesn't exist
					subtasksContainer = document.createElement('div');
					subtasksContainer.className = 'subtasks-container';
					subtasksContainer.id = `subtasks-${task.parentTaskId}`;
					parentContainer.appendChild(subtasksContainer);
				}

				// Add the new subtask to the container
				subtasksContainer.appendChild(taskElement);
				// Ensure the parent task shows it has subtasks
				const parentTaskItem = parentContainer.querySelector('.task-item');
				const expandIndicator = parentTaskItem.querySelector('.task-expand-indicator');
				expandIndicator.classList.remove('hidden');
				// Expand the parent container to show the new subtask
				subtasksContainer.classList.add('expanded');
				const containerHeight = this.calculateContainerHeight(subtasksContainer);
				subtasksContainer.style.maxHeight = `${containerHeight}px`;
				// Update parent containers' heights
				this.updateParentContainers(subtasksContainer);
			} else {
				console.error('Parent task not found for subtask:', task.id);
			}
		} else {
			// This is a top-level task
			this.elements.taskList.appendChild(taskElement);
		}
		// Add highlight animation to the task-item
		const taskItem = taskElement.querySelector('.task-item');
		taskItem.style.animation = 'highlightNew 2s ease-out';
		// Clean up animation after it completes
		taskItem.addEventListener('animationend', () => {
			taskItem.style.animation = '';
		});
	},

	getRecurringDescription: function (recurring) {
		if (!recurring) return '';
		let recurringData = recurring;

		if (typeof recurring === 'string') {
			try {
				recurringData = JSON.parse(recurring);
			} catch (e) {
				console.error('Error parsing recurring data:', e);
				return 'Recurring task';
			}
		}

		const dayNames = {
			MO: 'Monday',
			TU: 'Tuesday',
			WE: 'Wednesday',
			TH: 'Thursday',
			FR: 'Friday',
			SA: 'Saturday',
			SU: 'Sunday'
		};

		let description = 'Repeats ';

		switch (recurringData.frequency) {
			case 'daily': description += 'daily'; break;
			case 'weekly': description += 'weekly'; break;
			case 'weekday': description += 'every weekday'; break;
			case 'biweekly': description += 'every 2 weeks'; break;
			case 'monthly': description += 'monthly'; break;
			case 'yearly': description += 'yearly'; break;
			case 'custom': description += 'with custom pattern'; break;
			default: description += 'with unknown pattern';
		}

		if (recurringData.end) {
			if (recurringData.end.type === 'after') {
				description += `, ${recurringData.end.after_occurrences} times`;
			} else if (recurringData.end.type === 'on' && recurringData.end.date) {
				description += `, until ${recurringData.end.date}`;
			}
		}

		return description;
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

	editTaskDueDate: function (event, taskId) {
		const container = taskId === 'modal' ?
			event.currentTarget.closest('.due-date-container') :
			event.currentTarget.closest('.meta-item');
		const dropdown = container.querySelector('.date-picker-dropdown');
		// Close any other open dropdowns
		document.querySelectorAll('.date-picker-dropdown').forEach(d => {
			if (d !== dropdown)
				d.style.display = 'none';
		});

		dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
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

	setQuickDate: function (event, taskId, type) {
		event.stopPropagation();
		const now = new Date();
		const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
					now.getUTCDate()));
		let date;
		switch (type) {
		case 'today':
			date = today;
			break;
		case 'tomorrow':
			date = new Date(today);
			date.setUTCDate(today.getUTCDate() + 1);
			break;
		case 'nextWeek':
			date = new Date(today);
			date.setUTCDate(today.getUTCDate() + 7);
			break;
		}
		const formattedDate = date.toISOString().split('T')[0];
		if (taskId === 'modal') {
			this.updateDueDateDisplay(taskId, formattedDate);
		} else {
			this.updateDueDateDisplay(taskId, formattedDate);
			TaskManager.updateTaskField(taskId, 'dueDate', formattedDate);
		}
	},

	clearDueDate: function (event, taskId) {
		event.stopPropagation();
		UIManager.updateDueDateDisplay(taskId, '');
		if (taskId !== 'modal') {
			this.updateTaskField(taskId, 'dueDate', '');
		}
	},

	updateDueDateDisplay: function (taskId, newDate) {
		const isModal = taskId === 'modal';
		const container = isModal ?
			document.querySelector('#taskForm .due-date-container') :
			document.querySelector(`.task-container[data-task-id="${taskId}"] .due-date-container`);
		if (!container)
			return;
		const dueDate = container.querySelector('.due-date');
		const dropdown = container.querySelector('.date-picker-dropdown');
		const dateInput = dropdown.querySelector('.date-input');
		const displayElement = isModal ? document.getElementById('modalDueDateDisplay') :
			dueDate;
		if (!isModal) {
			dueDate.setAttribute('data-raw-date', newDate);
		}
		displayElement.textContent = newDate || 'None';
		dateInput.value = newDate;
		// Always close the dropdown after selection
		dropdown.style.display = 'none';
	},

	togglePriorityDropdown: function (event, taskId) {
		event.stopPropagation();
		const container = taskId === 'modal'
			 ? event.currentTarget.closest('.priority-container')
			 : event.currentTarget.closest('.task-container');
		const dropdown = container.querySelector('.priority-dropdown');
		// Ensure dropdown has initial display style
		if (!dropdown.style.display) {
			dropdown.style.display = 'none';
		}

		// Close any other open dropdowns
		document.querySelectorAll('.priority-dropdown').forEach(d => {
			if (d !== dropdown)
				d.style.display = 'none';
		});
		dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
		// Close dropdown when clicking outside
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

	updatePriorityDisplay: function (taskId, priority) {
		const container = taskId === 'modal'
			 ? document.querySelector('#taskForm .priority-container')
			 : document.querySelector(`.task-container[data-task-id="${taskId}"] .priority-container`);
		if (!container)
			return;
		const priorityElement = container.querySelector('.priority');
		const dropdown = container.querySelector('.priority-dropdown');
		const displayElement = taskId === 'modal' ?
			document.getElementById('modalPriorityDisplay') : priorityElement;
		if (displayElement) {
			displayElement.textContent = priority;
		}
		if (priorityElement) {
			priorityElement.className = `priority priority-${priority}`;
		}
		if (dropdown) {
			dropdown.style.display = 'none';

		}
		if (taskId === 'modal') {
			const priorityHidden = document.getElementById('priorityHidden');
			if (priorityHidden) {
				priorityHidden.value = priority;
			}
		}
	},

	toggleFilters: function () {
		this.filterContainer.classList.toggle('expanded');
		const toggleButton = document.getElementById('toggleFilters');
		toggleButton.textContent = filterContainer.classList.contains('expanded') ? 'Filters ▲' : 'Filters ▼';
	},

};