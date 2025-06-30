import { DataManager } from './DataManager.js';
import { TaskManager } from './TaskManager.js';
import { Snackbar, Throbber } from './UIHelpers.js';
import { ModalManager } from './ModalManager.js'; // Import the new ModalManager
import { TaskRenderer } from './TaskRenderer.js'; // Import the new TaskRenderer
import APIManager from './APIManager.js';

let closeUniversalDueDateDropdownHandler = null;
let closeUniversalPriorityDropdownHandler = null;

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

		this.elements.universalDueDateDropdown = this.createUniversalDueDateDropdown();
		document.body.appendChild(this.elements.universalDueDateDropdown);
		this.elements.universalPriorityDropdown = this.createUniversalPriorityDropdown();
		document.body.appendChild(this.elements.universalPriorityDropdown);

		this.setupEventListeners();
		TaskRenderer.setUIManager(this); // Set the reference to UIManager
		ModalManager.init(); // Initialize ModalManager
	},

	setupEventListeners: function () {
		document.getElementById('toggleFilters').addEventListener('click', (e) => this.toggleFilters());
	},

	setupRecurringControls: function (handlers) {
		ModalManager.setupRecurringControls(handlers);
	},

	setupRecurringEditControls: function (handlers) {
		ModalManager.setupRecurringEditControls(handlers);
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
		ModalManager.showTaskForm(parentId);
	},

	hideTaskForm: function () {
		ModalManager.hideTaskForm();
	},

	showRecurringEditForm: function (taskId) {
		ModalManager.showRecurringEditForm(taskId);
	},

	populateRecurringEditForm: function (recurringData) {
		ModalManager.populateRecurringEditForm(recurringData);
	},

	hideRecurringEditForm: function () {
		ModalManager.hideRecurringEditForm();
	},

	showCategoryForm: function () {
		ModalManager.showCategoryForm();
	},

	refreshCategoryDropdown() {
		const select = document.getElementById('taskCategory'); // This is the select in the task form modal
		if (!select) return;

		select.innerHTML = DataManager.state.categories.map(c =>
			`<option value="${c.id ?? ''}">${c.name}</option>`
		).join('');
	},

	hideCategoryForm: function () {
		document.getElementById('categoryModal').style.display = 'none';
	},

	createTaskElement: function (task) {
		return TaskRenderer.createTaskElement(task);
	},

	toggleSubtasks: function (taskId, event) {
		if (event) event.stopPropagation();

		const subtasksContainer = document.getElementById(`subtasks-${taskId}`);
		const indicator = event.target.closest('.task-expand-indicator');

		if (subtasksContainer && indicator) {
			const isCollapsing = subtasksContainer.classList.contains('expanded');

			if (isCollapsing) {
				// To collapse smoothly, set a specific height first, then transition to 0
				subtasksContainer.style.maxHeight = `${subtasksContainer.scrollHeight}px`;
				subtasksContainer.offsetHeight; // Force reflow
				subtasksContainer.classList.remove('expanded');
				indicator.classList.remove('expanded');
				subtasksContainer.style.maxHeight = '0px';
			} else {
				subtasksContainer.classList.add('expanded');
				indicator.classList.add('expanded');
				subtasksContainer.style.maxHeight = `${subtasksContainer.scrollHeight}px`;
			}

			// After toggling, update the height of any parent collapsible sections
			// Use setTimeout to allow the browser to reflow and calculate the new scrollHeight before updating parents.
			setTimeout(() => this.updateParentContainers(subtasksContainer), 0);
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
			categoryItem.innerHTML = `<span class="category-text">${category.name}</span>`;
			categoryItem.onclick = () => TaskManager.selectCategory(category);
			if (category.name === DataManager.state.currentCategory.name) {
				categoryItem.classList.add('active');
			}
			categoryList.appendChild(categoryItem);
		});
	},

	updateCategorySelection: function (category) {
		document.querySelectorAll('.category-item').forEach(item => {
			item.classList.toggle('active', item.textContent.trim() === category.name);
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
				taskElement.appendChild(TaskRenderer.createTaskElement(task));
				this.elements.taskList.appendChild(taskElement);

				// Render its subtasks
				this.renderSubtasks(task.id, taskMap, taskElement);
			}
		});
	},

	renderSubtasks: function (parentId, taskMap, parentElement) {
		// Create subtasks container if the parent has subtasks
		const parentTask = taskMap.get(parentId);
		if (!parentTask.hasSubtasks) return;

		// The parentElement is the task-container. We need to find the collapsible part inside it.
		const detailsCollapsible = parentElement.querySelector('.task-details-collapsible');
		if (!detailsCollapsible) {
			console.error('Could not find .task-details-collapsible for task', parentId);
			return;
		}

		const subtasksContainer = document.createElement('div');
		subtasksContainer.className = 'subtasks-container';
		subtasksContainer.id = `subtasks-${parentId}`;
		detailsCollapsible.appendChild(subtasksContainer);
		taskMap.forEach(task => {
			if (task.parentTaskId === parentId) {
				const taskElement = document.createElement('div');
				taskElement.className = `task-container category-${task.category || 'none'}`;
				taskElement.setAttribute('data-task-id', task.id);
				taskElement.appendChild(TaskRenderer.createTaskElement(task));
				subtasksContainer.appendChild(taskElement);
				// Recursively render any nested subtasks
				this.renderSubtasks(task.id, taskMap, taskElement);
			}
		});
	},

	calculatePotentialHeight: function (element) {
		// Create a clone of the element to measure its potential height without affecting the live DOM.
		// This is crucial to avoid flickering or triggering unwanted transitions.
		const clone = element.cloneNode(true);

		// Position the clone off-screen so it doesn't interfere with the layout or cause scrollbars.
		clone.style.visibility = 'hidden';
		clone.style.position = 'absolute';
		clone.style.top = '-9999px';
		clone.style.left = '-9999px';
		// Ensure the clone itself is not constrained by a max-height.
		clone.style.maxHeight = 'none';

		// Find all collapsible descendants within the clone and force them to expand.
		// This simulates the "fully expanded" state.
		const collapsibles = clone.querySelectorAll('.task-details-collapsible, .subtasks-container');
		collapsibles.forEach(collapsible => {
			// By setting max-height to 'none', we allow them to take up their full content height.
			collapsible.style.maxHeight = 'none';
		});

		// Append the clone to the body to allow the browser to calculate its dimensions.
		document.body.appendChild(clone);
		// The scrollHeight of the clone now represents the total height if everything inside were expanded.
		const potentialHeight = clone.scrollHeight;
		// Immediately remove the clone from the DOM.
		document.body.removeChild(clone);
		return potentialHeight;
	},

	updateParentContainers: function (container) {
		let parent = container.parentElement;

		while (parent) {
			// If an ancestor is an expanded container, recalculate its height
			if (parent.matches('.task-details-collapsible.expanded, .subtasks-container.expanded')) {
				// We calculate the potential height to account for all nested children being expanded.
				parent.style.maxHeight = `${this.calculatePotentialHeight(parent)}px`;
			}
			parent = parent.parentElement;
		}
	},

	addTaskToUI: function (task) {
		const taskElement = document.createElement('div');
		taskElement.className = `task-container category-${task.category || 'none'}`;
		taskElement.setAttribute('data-task-id', task.id);
		taskElement.appendChild(TaskRenderer.createTaskElement(task));

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
				// Expand the subtask container to show the new subtask.
				// The new subtask is already in the container, so scrollHeight will give the correct new height.
				subtasksContainer.classList.add('expanded');
				subtasksContainer.style.maxHeight = `${subtasksContainer.scrollHeight}px`;
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

	toggleFilters: function () {
		this.elements.filterContainer.classList.toggle('expanded');
		const toggleButton = document.getElementById('toggleFilters');
		toggleButton.textContent = this.elements.filterContainer.classList.contains('expanded') ? 'Filters ▲' : 'Filters ▼';
	},

	// Helper function to format date for display
	formatDateForDisplay: function (dateString) {
		if (!dateString) {
			return 'None';
		}
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) { // Check for invalid date
				return dateString; // Return original string if invalid
			}
			return "Due: " + new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
		} catch (e) {
			console.error('Error formatting date:', e);
			return dateString; // Fallback to original string on error
		}
	},

	createUniversalDueDateDropdown: function () {
		const dropdown = document.createElement('div');
		dropdown.className = 'due-date-dropdown'; // Use existing class for styling
		dropdown.style.position = 'absolute'; // Must be positioned absolutely
		dropdown.style.display = 'none'; // Start hidden
		dropdown.style.zIndex = '1010'; // Ensure it's on top

		const options = ['Today', 'Tomorrow', 'Next Week', 'Next Month', 'No Due Date'];
		options.forEach(option => {
			const optionElement = document.createElement('div');
			optionElement.className = `due-date-option due-date-${option.toLowerCase().replace(/ /g, '-')}`;
			optionElement.textContent = option;
			optionElement.addEventListener('click', (e) => {
				e.stopPropagation();
				const taskId = dropdown.dataset.taskId;
				if (taskId) {
					TaskManager.updateDueDateDisplay(e, parseInt(taskId, 10), option);
					TaskManager.updateTaskField(taskId, 'dueDate', newDueDate);
				}
				this.hideUniversalDueDateDropdown();
			});
			dropdown.appendChild(optionElement);
		});

		return dropdown;
	},

	toggleUniversalDueDateDropdown: function (targetElement, taskId) {
		const dropdown = this.elements.universalDueDateDropdown;
		// If a listener from a previous dropdown is active, remove it first to prevent conflicts.
		if (closeUniversalDueDateDropdownHandler) {
			document.removeEventListener('click', closeUniversalDueDateDropdownHandler);
			closeUniversalDueDateDropdownHandler = null;
		}
		if (dropdown.style.display === 'block' && dropdown.dataset.taskId === String(taskId)) {
			this.hideUniversalDueDateDropdown();
			return;
		}
		// Store the task ID on the dropdown so its options know which task to update
		dropdown.dataset.taskId = taskId;
		// Position and show the dropdown
		const rect = targetElement.getBoundingClientRect();
		const dropdownWidth = rect.width;
		let dropdownLeft = rect.left;
		const viewportWidth = window.innerWidth;
		const margin = 8; // A small margin from the viewport edge
		// If the dropdown would overflow the right edge of the viewport, adjust its position.
		if (dropdownLeft + dropdownWidth > viewportWidth) {
			dropdownLeft = viewportWidth - dropdownWidth - margin;
		}
		dropdown.style.left = `${dropdownLeft}px`;
		dropdown.style.top = `${rect.bottom + window.scrollY}px`;
		dropdown.style.width = `${dropdownWidth}px`; // Set width to match the target
		dropdown.style.display = 'block';
		// Use setTimeout to avoid the current click event from immediately closing the dropdown
		setTimeout(() => {
			closeUniversalDueDateDropdownHandler = (e) => {
				if (!dropdown.contains(e.target) && e.target !== targetElement) {
					this.hideUniversalDueDateDropdown();
				}
			};
			document.addEventListener('click', closeUniversalDueDateDropdownHandler);
		}, 0);
	},

	hideUniversalDueDateDropdown: function () {
		const dropdown = this.elements.universalDueDateDropdown;
		if (dropdown) {
			dropdown.style.display = 'none';
			delete dropdown.dataset.taskId;
		}
		if (closeUniversalDueDateDropdownHandler) {
			document.removeEventListener('click', closeUniversalDueDateDropdownHandler);
			closeUniversalDueDateDropdownHandler = null;
		}
	},

	createUniversalPriorityDropdown: function () {
		const dropdown = document.createElement('div');
		dropdown.className = 'priority-dropdown'; // Use existing class for styling
		dropdown.style.position = 'absolute'; // Must be positioned absolutely
		dropdown.style.display = 'none'; // Start hidden
		dropdown.style.zIndex = '1010'; // Ensure it's on top

		['Low', 'Medium', 'High'].forEach(level => {
			const option = document.createElement('div');
			option.className = `priority-option priority-${level}`;
			option.textContent = level;
			option.addEventListener('click', (e) => {
				e.stopPropagation();
				const taskId = dropdown.dataset.taskId;
				if (taskId) {
					TaskManager.updatePriority(e, parseInt(taskId, 10), level);
				}
				this.hideUniversalPriorityDropdown();
			});
			dropdown.appendChild(option);
		});

		return dropdown;
	},

	toggleUniversalPriorityDropdown: function (targetElement, taskId) {
		const dropdown = this.elements.universalPriorityDropdown;

		// If a listener from a previous dropdown is active, remove it first to prevent conflicts.
		if (closeUniversalPriorityDropdownHandler) {
			document.removeEventListener('click', closeUniversalPriorityDropdownHandler);
			closeUniversalPriorityDropdownHandler = null;
		}

		if (dropdown.style.display === 'block' && dropdown.dataset.taskId === String(taskId)) {
			this.hideUniversalPriorityDropdown();
			return;
		}

		// Store the task ID on the dropdown so its options know which task to update
		dropdown.dataset.taskId = taskId;

		// Position and show the dropdown
		const rect = targetElement.getBoundingClientRect();
		const dropdownWidth = rect.width;
		let dropdownLeft = rect.left;
		const viewportWidth = window.innerWidth;
		const margin = 8; // A small margin from the viewport edge

		// If the dropdown would overflow the right edge of the viewport, adjust its position.
		if (dropdownLeft + dropdownWidth > viewportWidth) {
			dropdownLeft = viewportWidth - dropdownWidth - margin;
		}

		dropdown.style.left = `${dropdownLeft}px`;
		dropdown.style.top = `${rect.bottom + window.scrollY}px`;
		dropdown.style.width = `${dropdownWidth}px`; // Set width to match the target
		dropdown.style.display = 'block';

		// Use setTimeout to avoid the current click event from immediately closing the dropdown
		setTimeout(() => {
			closeUniversalPriorityDropdownHandler = (e) => {
				if (!dropdown.contains(e.target) && e.target !== targetElement) {
					this.hideUniversalPriorityDropdown();
				}
			};
			document.addEventListener('click', closeUniversalPriorityDropdownHandler);
		}, 0);
	},

	hideUniversalPriorityDropdown: function () {
		const dropdown = this.elements.universalPriorityDropdown;
		if (dropdown) {
			dropdown.style.display = 'none';
			delete dropdown.dataset.taskId;
		}
		if (closeUniversalPriorityDropdownHandler) {
			document.removeEventListener('click', closeUniversalPriorityDropdownHandler);
			closeUniversalPriorityDropdownHandler = null;
		}
	},
};