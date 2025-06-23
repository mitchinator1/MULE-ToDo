import { UIManager } from './UIManager.js';
import { DataManager } from './DataManager.js';
import APIManager from './APIManager.js';
import FilterManager from './FilterManager.js';

export const TaskManager = {
	recurringPatterns: {
		daily: {
			days: 1
		},
		weekday: {
			weekdays: true
		},

		weekly: {
			weeks: 1
		},
		biweekly: {
			weeks: 2
		},
		monthly: {
			months: 1
		},
		yearly: {
			years: 1
		}
	},

	async init() {
		try {
			UIManager.init();
			DataManager.init();
			this.setupEventListeners();
			UIManager.setupRecurringControls();
			UIManager.setupRecurringEditControls({
				onRecurringEditSubmit: this.handleRecurringEditSubmit.bind(this)
			});
			UIManager.renderCategories(DataManager.state.categories);
			UIManager.setupSidebar();
			FilterManager.setupFilters();
			// Only load tasks from server if we don't have any saved
			if (DataManager.state.tasks.length === 0) {
				await this.loadTasks();
			} else {
				// Otherwise, just render the saved tasks
				this.renderTasks();
			}
		} catch (error) {
			console.error('Initialization error:', error);
			UIManager.showErrorMessage(error, 'initializing application');
		}
	},

	setupEventListeners() {
		UIManager.elements.formElement.addEventListener('submit', this.handleFormSubmit.bind(this));
		UIManager.elements.addTaskButton.addEventListener('click', () => UIManager.showTaskForm());
		document.addEventListener('click', (event) => {
			if (event.target === UIManager.elements.taskForm) {
				UIManager.hideTaskForm();
			}
		});

		document.getElementById('dueDate')?.addEventListener('change', (e) => this.updateDueDate(e, 'modal'));
		document.getElementById('dueDate')?.addEventListener('click', (e) => e.stopPropagation());

		document.querySelectorAll('.priority-option').forEach(option =>
			option.addEventListener('click', (e) => this.updatePriority(e, 'modal', option.textContent.trim())));
	},

	async loadTasks() {
		try {
			UIManager.showThrobber('Loading tasks');
			const response = await APIManager.getTasks();
			console.log('Tasks loaded:', response);
			// Parse the response if it's a string
			const tasks = typeof response === 'string' ? JSON.parse(response) : response;
			// Ensure we have an array
			const tasksArray = Array.isArray(tasks) ? tasks : [];
			DataManager.setTasks(tasksArray);
			this.renderTasks();
		} catch (error) {
			UIManager.showErrorMessage(error, 'loading tasks');
		} finally {
			UIManager.hideThrobber('Loading tasks');
		}
	},

	renderTasks() {
		const filteredTasks = DataManager.getFilteredAndSortedTasks();
		UIManager.renderTaskList(filteredTasks);
	},

	async handleFormSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);

		// Get the task name and validate it
		const taskName = formData.get('taskName');
		if (!taskName || taskName.trim() === '') {
			console.error('Task name is required');
			UIManager.showMessage('Task name is required', { type: 'error' });
			return;
		}

		// Prepare taskData with default values for various fields
		const taskData = {
			title: taskName.trim(),
			description: formData.get('description') || '',
			dueDate: formData.get('dueDate') || '',
			priority: formData.get('priority') || 'Low',
			status: 'Not Started',
			parentTaskId: formData.get('parentTaskId') || null,
			categoryId: formData.get('category') || null,
		};

		// Only add recurring data if a pattern is selected
		const pattern = document.getElementById('recurringPattern')?.value;
		if (pattern && pattern !== 'none') {
			taskData.recurring = this.getRecurringPattern();
			console.log('Recurring data:', taskData.recurring);
		}

		const taskId = formData.get('taskId');
		const isEditing = !!taskId; // true if taskId exists, false otherwise

		try {
			UIManager.showThrobber(isEditing ? 'Updating task' : 'Adding task');
			let result;

			if (isEditing) {
				const existingTask = DataManager.getTaskById(taskId);

				const changedFields = {};

				if (existingTask.title !== taskData.title) changedFields.title = taskData.title;
				if (existingTask.description !== taskData.description) changedFields.description = taskData.description;
				if (existingTask.dueDate !== taskData.dueDate) changedFields.dueDate = taskData.dueDate;
				if (existingTask.priority !== taskData.priority) changedFields.priority = taskData.priority;
				if (existingTask.status !== taskData.status) changedFields.status = taskData.status;
				if (existingTask.parentTaskId !== taskData.parentTaskId) changedFields.parentTaskId = taskData.parentTaskId;
				if (existingTask.categoryId !== taskData.categoryId) changedFields.categoryId = taskData.categoryId;

				if (JSON.stringify(existingTask.recurring) !== JSON.stringify(taskData.recurring)) {
					changedFields.recurring = taskData.recurring;
				}

				if (Object.keys(changedFields).length === 0) {
					UIManager.showMessage('No changes detected', 'info');
					UIManager.hideTaskForm();
					return;
				}

				result = await APIManager.updateTask(taskId, changedFields);

				if (result.message === 'Task updated successfully' && result.task) {
					DataManager.updateTask(result.task);
					UIManager.updateTaskElement(taskId, result.task);
					UIManager.showMessage('Task updated successfully', 'success');
				} else {
					 // Handle cases where update might succeed but task object is not returned or message is different
					 UIManager.showErrorMessage(`Update failed or no task returned: ${result.message || 'Unknown error'}`, `updating task`);
				}
			} else { // Adding a new task

				result = await APIManager.addTask(taskData);

				if (result.id) { // Check for the ID to confirm success for add
					DataManager.addTask(result);
					UIManager.addTaskToUI(result);
					UIManager.showMessage('Task added successfully', 'success');
				} else {
					UIManager.showErrorMessage(`Add failed or no task ID returned`, `adding task`);
				}
			}
		} catch (error) {
			console.error('Error in handleFormSubmit:', error);
			UIManager.showErrorMessage(error, isEditing ? 'updating task' : 'adding task');
		} finally {
			UIManager.hideTaskForm();
			UIManager.hideThrobber(isEditing ? 'Updating task' : 'Adding task');
			if (!isEditing) { // Only reset if it was an add operation
				event.target.reset();
			}
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
			UIManager.showThrobber('Updating status');
			const result = await APIManager.updateTask(taskId, {
				status: status
			});
			if (result.message === 'Task updated successfully' && result.task) {
				DataManager.updateTask(result.task);
				UIManager.updateTaskElement(taskId, result.task);
				if (status === 'Completed' && JSON.stringify(result.task.recurring) !== "{}") {
					await this.handleRecurringTask(result.task);
				}
				UIManager.showMessage('Status updated successfully', 'success');

			}
		} catch (error) {
			UIManager.showErrorMessage(error, 'updating status');
		} finally {
			UIManager.hideThrobber('Updating status');
		}
	},

	async deleteTask(taskId) {
		try {
			UIManager.showThrobber('Deleting task');
			const result = await APIManager.deleteTask(taskId);
			if (result.message === 'Task deleted successfully') {
				DataManager.deleteTask(taskId);
				UIManager.deleteTaskElement(taskId);
				UIManager.showMessage('Task deleted successfully', 'success');
			}
		} catch (error) {
			UIManager.showErrorMessage(error, 'deleting task');
		} finally {
			UIManager.hideThrobber('Deleting task');
		}
	},

	async handleRecurringTask(task) {
		const nextOccurrence = this.calculateNextOccurrence(task);
		if (nextOccurrence) {
			await this.createNextRecurringTask(task, nextOccurrence);
		}
	},

	calculateNextOccurrence(task) {
		if (!task.recurring || JSON.stringify(task.recurring) === "{}") return null;

		const lastDate = new Date(task.dueDate);
		const pattern = task.recurring;
		let nextDate = new Date(lastDate);

		switch (pattern.pattern) {
			case 'daily':
				nextDate.setDate(lastDate.getDate() + 1);
				break;
			case 'weekday':
				do {
					nextDate.setDate(nextDate.getDate() + 1);
				} while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
				break;
			case 'weekly':
				nextDate.setDate(lastDate.getDate() + 7);
				break;
			case 'biweekly':
				nextDate.setDate(lastDate.getDate() + 14);
				break;
			case 'monthly':
				nextDate.setMonth(lastDate.getMonth() + 1);
				break;
			case 'yearly':
				nextDate.setFullYear(lastDate.getFullYear() + 1);
				break;
			case 'custom':
				const { value, unit } = pattern.interval;
				switch (unit) {
					case 'days':
						nextDate.setDate(lastDate.getDate() + value);
						break;
					case 'weeks':
						nextDate.setDate(lastDate.getDate() + (value * 7));
						break;
					case 'months':
						nextDate.setMonth(lastDate.getMonth() + value);
						break;
					case 'years':
						nextDate.setFullYear(lastDate.getFullYear() + value);
						break;
				}
				break;
		}
		// Check if we've reached the end
		if (pattern.end.type === 'on' && nextDate > new Date(pattern.end.value)) {
			return null;
		}
		if (pattern.end.type === 'after') {
			// Decrement the occurrence count
			pattern.end.value--;
			if (pattern.end.value <= 0) {
				return null;
			}
		}
		return nextDate;
	},

	async createNextRecurringTask(task, nextDate) {
		const nextTask = {
			...task,
			status: "Not Started",
			dueDate: nextDate.toISOString().split('T')[0],
			isRecurringInstance: true,
			originalTaskId: task.id
		};
		try {
			const result = await APIManager.addTask(nextTask);
			if (result.message === 'Task updated successfully' && result.task) {
				DataManager.addTask(result.task);
				this.renderTasks();
			}
		} catch (error) {
			UIManager.showErrorMessage(error, 'creating next recurring task');
		}
	},

	async updateTaskField(taskId, field, value) {
		try {
			UIManager.showThrobber(`Updating ${field}`);
			const result = await APIManager.updateTask(taskId, {
				[field]: value // Dynamically create the updates object, e.g., { title: "new value" }
			});
			if (result.message === 'Task updated successfully' && result.task) {
				DataManager.updateTask(result.task);
				UIManager.updateTaskElement(taskId, result.task);
				UIManager.showMessage('Task updated successfully', 'success');
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
			const container = event.target.closest('.title-container');
			const titleSpan = container.querySelector('.task-title');
			if (newTitle !== titleSpan.textContent) {
				titleSpan.textContent = newTitle; // Update UI immediately
				this.updateTaskField(taskId, 'title', newTitle);
			}
		}
		UIManager.finishTitleEdit(event.target.closest('.title-container'));
	},

	updateDescription(event, taskId) {
		const newDescription = event.target.value.trim();
		const container = event.target.closest('.description-container');
		const descriptionDiv = container.querySelector('.description');
		const oldDescription = descriptionDiv.textContent.trim();
		// Check if there are changes
		if (newDescription !== oldDescription) {
			if (oldDescription !== 'Add description...') {
				descriptionDiv.innerHTML = newDescription || '<span class="placeholder">Add description...</span>';
				this.updateTaskField(taskId, 'description', newDescription);
			}
		}
		UIManager.finishDescriptionEdit(container);
	},

	updateDueDate(event, taskId) {
		event.stopPropagation();
		const newDueDate = event.target.value;
		if (taskId === 'modal') {
			UIManager.updateDueDateDisplay(taskId, newDueDate);
		} else {
			// Update UI immediately and close dropdown
			UIManager.updateDueDateDisplay(taskId, newDueDate);
			// Then update server
			this.updateTaskField(taskId, 'dueDate', newDueDate);
		}
	},

	updatePriority(event, taskId, priority) {
		event.stopPropagation(); // Prevent the event from bubbling up
		if (taskId === 'modal') {
			UIManager.updatePriorityDisplay(taskId, priority);
		} else {
			// First update UI
			UIManager.updatePriorityDisplay(taskId, priority);
			// Then update server
			this.updateTaskField(taskId, 'priority', priority);
		}
	},

	async handleRecurringEditSubmit(e) {
		e.preventDefault();
		const taskId = e.target.elements.editRecurringTaskId.value;

		const recurring = this.getRecurringPattern('edit'); // already returns structured format
		if (!recurring || recurring.pattern === 'none') {
			// If pattern is none, remove recurring rule
			recurring.frequency = '';
		}

		try {
			UIManager.showThrobber('Updating recurring pattern');

			const result = await APIManager.updateTask(taskId, {
				recurring // send as object (NOT string)
			});

			console.log(result);

			if (result.message === 'Task updated successfully' && result.task) {
				DataManager.updateTask(result.task);
				UIManager.updateTaskElement(taskId, result.task);
			}
		} catch (error) {
			UIManager.showErrorMessage(error, 'updating recurring pattern');
		} finally {
			UIManager.hideThrobber('Updating recurring pattern');
			UIManager.hideRecurringEditForm();
		}
	},

	getRecurringPattern(prefix = '') {
		const patternId = prefix ? `${prefix}RecurringPattern` : 'recurringPattern';
		const customIntervalId = prefix ? `${prefix}CustomInterval` : 'customInterval';
		const customUnitId = prefix ? `${prefix}CustomUnit` : 'customUnit';
		const recurringEndName = prefix ? `${prefix}RecurringEnd` : 'recurringEnd';
		const occurenceCountId = prefix ? `${prefix}OccurenceCount` : 'occurenceCount';
		const endDateId = prefix ? `${prefix}EndDate` : 'endDate';
		const byMonthDayId = prefix ? `${prefix}ByMonthDay` : 'editByMonthDay';

		const frequency = document.getElementById(patternId)?.value || 'none';

		if (frequency === 'none') return {};

		const recurringData = {
			frequency,
			interval: null,
			by_day: null,
			by_month_day: null,
			end: {
				date: null,
				type: document.querySelector(`input[name="${recurringEndName}"]:checked`)?.value || 'never',
				after_occurrences: parseInt(document.getElementById(occurenceCountId)?.value) || null
			}
		};

		// Handle custom frequency interval
		if (frequency === 'custom') {
			const val = parseInt(document.getElementById(customIntervalId)?.value || '1');
			const unit = document.getElementById(customUnitId)?.value || 'days';
			recurringData.interval = { value: val, unit };
		}

		// Handle weekly/weekday frequency (checkboxes)
		if (frequency === 'weekly' || frequency === 'weekday') {
			const checked = Array.from(document.querySelectorAll('.weekday-checkbox'))
				.filter(cb => cb.checked)
				.map(cb => cb.value);
			if (checked.length) {
				recurringData.by_day = checked.join(',');
			}
		}

		// Handle monthly frequency (by_month_day)
		if (frequency === 'monthly') {
			const byMonthDay = document.getElementById(byMonthDayId)?.value;
			if (byMonthDay) {
				recurringData.by_month_day = byMonthDay;
			}
		}

		// Handle end type
		if (recurringData.end_type === 'after') {
			const occurenceCount = document.getElementById(occurenceCountId);
			recurringData.end.after_occurrences = occurenceCount ? parseInt(occurenceCount.value) : 1;
		} else if (recurringData.end.type === 'on') {
			const endDate = document.getElementById(endDateId);
			recurringData.end.date = endDate ? endDate.value : null;
		}

		const dueDateInput = document.getElementById(prefix ? `${prefix}DueDate` : 'dueDate');
		recurringData.start_date = dueDateInput?.value || new Date().toISOString().split('T')[0];

		return recurringData;
	},

	selectCategory(category) {
		DataManager.setCurrentCategory(category);
		this.renderTasks();
		UIManager.updateCategorySelection(category);
	},

};