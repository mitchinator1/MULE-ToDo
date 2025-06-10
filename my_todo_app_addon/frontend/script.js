class StyleManager {
    static styleSheets = new Map();
    static addStyles(id, styles, scope = '') {
        if (!this.styleSheets.has(id)) {
            const styleElement = document.createElement('style');
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
            this.styleSheets.set(id, styleElement);
        }
    }
    static removeStyles(id) {
        const styleElement = this.styleSheets.get(id);
        if (styleElement) {
            styleElement.remove();
            this.styleSheets.delete(id);
        }
    }
}

const MULE = (() => {
    // Public
    class Snackbar {
        static styleId = 'snackbar-styles';
        static instance = null;
        static initStyles() {
            if (!StyleManager.styleSheets.has(this.styleId)) {
                const styles = `
			.snackbar {
				display: flex;
				min-width: 250px;
				background-color: #4B286D;
				color: #fff;
				text-align: center;
				border-radius: 4px;
				padding: 16px;
				position: fixed;
				z-index: 1000;
				left: 50%;
				bottom: 30px;
				font-size: 17px;
				transform: translateX(-50%);
				justify-content: center;
				align-items: center;
				opacity: 0;
				transition: all 0.5s ease;
			}
			.snackbar.show {
				opacity: 1;
			}
			.snackbar.hide {
				opacity: 0;
			}
			.snackbar.success {
				background-color: #43a047;
			}
			.snackbar.warning {
				background-color: #e6e600;
				color: #000;
			}
			.snackbar.error {
				background-color: #d32f2f;
			}
			`;
                StyleManager.addStyles(this.styleId, styles);
            }
        }
        static show(text, options = {}) {
            const defaults = {
                duration: 1.5,
                type: 'default', // 'default', 'success', 'warning', 'error'
                position: 'bottom' // 'bottom', 'top'
            };
            const settings = {
                ...defaults,
                ...options
            };
            this.initStyles();
            if (this.instance) {
                this.instance.remove();
            }

            const snackbar = document.createElement('div');
            snackbar.className = `snackbar ${settings.type}`;
            snackbar.textContent = text;
            if (settings.position === 'top') {
                snackbar.style.bottom = 'auto';
                snackbar.style.top = '30px';
            }
            document.body.appendChild(snackbar);
            this.instance = snackbar;
            snackbar.offsetHeight;
            requestAnimationFrame(() => {
                snackbar.classList.add('show');
                setTimeout(() => {
                    snackbar.classList.add('hide');
                    snackbar.addEventListener('transitionend', () => {
                        if (snackbar.parentNode) {
                            snackbar.remove();
                            if (this.instance === snackbar) {
                                this.instance = null;
                            }
                        }
                    }, {
                        once: true
                    });
                }, settings.duration * 1000);
            });
        }
    }
    class Throbber {
        static styleId = 'throbber-styles';
        static instances = new Map();

        static show(id, options = {}) {
            const defaults = {
                color: 'black',
                size: '40px',
                speed: '1.5s',
                dotCount: 6,
                mode: 'blocking', // 'blocking' | 'inline'
                position: 'bottom-middle', // combination of bottom | top + left | middle | right
                message: '',
                messageStyle: 'default', // 'default' | 'minimal'
                animation: 'rotate', // 'rotate' | 'pulse' | 'bounce'
            };
            const settings = {
                ...defaults,
                ...options
            };
            this.initStyles();
            if (this.instances.has(id))
                return;
            const container = document.createElement('div');
            container.className = settings.mode === 'blocking'
                 ? 'throbber-container'
                 : 'throbber-container-inline';
            if (settings.mode === 'inline') {
                container.dataset.position = settings.position;
            }
            if (settings.message) {
                const messageEl = document.createElement('div');
                messageEl.className = `throbber-message ${settings.messageStyle}`;
                messageEl.textContent = settings.message;
                container.appendChild(messageEl);
            }

            const throbber = document.createElement('div');
            throbber.className = `throbber throbber-${settings.animation}`;
            throbber.style.setProperty('--uib-color', settings.color);
            throbber.style.setProperty('--uib-size', settings.size);
            throbber.style.setProperty('--uib-speed', settings.speed);
            for (let i = 0; i < settings.dotCount; i++) {
                const dot = document.createElement('div');
                dot.className = `throbber-dot`;
                if (settings.animation === 'rotate') {
                    const delay = -0.167 * (settings.dotCount - i) * 0.5;
                    dot.style.animationDelay = `calc(var(--uib-speed) * ${delay})`;
                } else {
                    const delay = (i / settings.dotCount) * 0.5;
                    dot.style.animationDelay = `calc(var(--uib-speed) * ${delay})`;
                }
                throbber.appendChild(dot);
            }
            if (settings.animation !== 'rotate') {
                const totalWidth =
                    (parseFloat(settings.size) * 0.25 * settings.dotCount) + // Dots width
					(parseFloat(settings.size) * 0.15 * (settings.dotCount - 1)); // Gaps width
                throbber.style.width = `${totalWidth}px`;
            }
            container.appendChild(throbber);
            document.body.appendChild(container);
            this.instances.set(id, container);
        }

        static initStyles() {
            if (!StyleManager.styleSheets.has(this.styleId)) {
                const styles = `
			/* Common styles */
			.throbber-container {
				text-align: initial;
				border: none;
				display: flex;
				justify-content: center;
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background-color: rgba(255, 255, 255, 0.7);
				z-index: 1000;
			}
			.throbber-container .throbber {
				position: absolute;
				top: 75%;
			}
			.throbber-container-inline {
				text-align: initial;
				border: none;
				display: flex;
				justify-content: center;
				align-items: center;
				position: fixed;
				padding: 12px;
				background-color: rgba(255, 255, 255, 0.9);
				border-radius: 4px;
				box-shadow: 0 2px 4px rgba(0,0,0,0.1);
				z-index: 1000;
			}
	
			/* Positioning styles for inline mode */
			.throbber-container-inline[data-position="top-left"] { 
				top: 16px; left: 16px;
			}
	
			.throbber-container-inline[data-position="top-middle"] { 
				top: 16px; left: 50%; transform: translateX(-50%);
			}
	
			.throbber-container-inline[data-position="top-right"] { 
				top: 16px; right: 16px;
			}
	
			.throbber-container-inline[data-position="bottom-left"] { 
				bottom: 16px; left: 16px;
			}
	
			.throbber-container-inline[data-position="bottom-middle"] { 
				bottom: 16px; left: 50%; transform: translateX(-50%);
			}
	
			.throbber-container-inline[data-position="bottom-right"] { 
				bottom: 16px; right: 16px;
			}
	
			.throbber-container-inline .throbber {
				position: relative;
				top: initial;
			}
			.throbber {
				--uib-size: 40px;
				--uib-color: black;
				--uib-speed: 1.5s;
				position: relative;
				display: flex;
				align-items: center;
				justify-content: center;
				height: var(--uib-size);
				width: var(--uib-size);
			}
			.throbber-message {
				margin-right: 12px;
				font-size: 14px;
				color: var(--uib-color);
			}
			.throbber-message.minimal {
				font-size: 12px;
				opacity: 0.8;
			}
			
			/* Rotate Animation */
			.throbber-rotate {
				animation: throbber-smoothRotate calc(var(--uib-speed) * 1.8) linear infinite;
			}
			.throbber-rotate .throbber-dot {
				position: absolute;
				top: 0;
				left: 0;
				display: flex;
				align-items: flex-start;
				justify-content: center;
				height: 100%;
				width: 100%;
				animation: throbber-rotate var(--uib-speed) ease-in-out infinite;
			}
			.throbber-rotate .throbber-dot::before {
				content: '';
				height: calc(var(--uib-size) * 0.17);
				width: calc(var(--uib-size) * 0.17);
				border-radius: 50%;
				background-color: var(--uib-color);
				transition: background-color 0.3s ease;
			}
			
			.throbber-rotate .throbber-dot:nth-child(2) { 
				animation-delay: calc(var(--uib-speed) * -0.835 * 0.5);
			}
	
			.throbber-rotate .throbber-dot:nth-child(3) { 
				animation-delay: calc(var(--uib-speed) * -0.668 * 0.5);
			}
	
			.throbber-rotate .throbber-dot:nth-child(4) {
				animation-delay: calc(var(--uib-speed) * -0.501 * 0.5);
			}
	
			.throbber-rotate .throbber-dot:nth-child(5) {
				animation-delay: calc(var(--uib-speed) * -0.334 * 0.5);
			}
	
			.throbber-rotate .throbber-dot:nth-child(6) {
				animation-delay: calc(var(--uib-speed) * -0.167 * 0.5);
			}
			
			@keyframes throbber-rotate {
				0% { transform: rotate(0deg); }
				65%, 100% { transform: rotate(360deg); }
			}
			@keyframes throbber-smoothRotate {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			
			/* Pulse Animation */
			.throbber-pulse {
			width: auto;
			height: var(--uib-size);
			display: flex;
			justify-content: center;
			align-items: center;
			gap: calc(var(--uib-size) * 0.15);
			}
			.throbber-pulse .throbber-dot {
			width: calc(var(--uib-size) * 0.25);
			height: calc(var(--uib-size) * 0.25);
			border-radius: 50%;
			background-color: var(--uib-color);
			animation: pulse-animation var(--uib-speed) ease-in-out infinite;
			}
	
			@keyframes pulse-animation {
			0%, 100% { transform: scale(0.5); opacity: 0.3; }
			50% { transform: scale(1); opacity: 1; }
			}
			/* Bounce Animation */
			.throbber-bounce {
			width: auto;
			height: var(--uib-size);
			display: flex;
			justify-content: center;
			align-items: flex-end;
			gap: calc(var(--uib-size) * 0.15);
			}
			.throbber-bounce .throbber-dot {
			width: calc(var(--uib-size) * 0.25);
			height: calc(var(--uib-size) * 0.25);
			border-radius: 50%;
			background-color: var(--uib-color);
			animation: bounce-animation var(--uib-speed) ease-in-out infinite;
			}
			@keyframes bounce-animation {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(calc(var(--uib-size) * -0.75)); }
			}
			`;
                StyleManager.addStyles(this.styleId, styles);
            }
        }
        static hide(id) {
            const throbber = this.instances.get(id);
            if (throbber) {

                throbber.remove();
                this.instances.delete(id);
            }
        }
    }

    const debounce = (func, delay) => {
        let timeoutId;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }
    return {
        Snackbar,
        Throbber,
        debounce
    };
})();

const TaskManager = {
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
	},
	
	async loadTasks() {
		try {
			UIManager.showThrobber('Loading tasks');
			const response = await APIManager.getTasks();
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
			dueDate: formData.get('dueDate') || '', // You'll need to parse/format dates if saving to DB
			priority: formData.get('priority') || 'Low',
			status: 'Not Started',
			parentTaskId: formData.get('parentTaskId') || '',
			category: formData.get('category') || '',
			progress: 0
		};

		// Only add recurring data if a pattern is selected
		const pattern = document.getElementById('recurringPattern')?.value;
		if (pattern && pattern !== 'none') {
			taskData.recurring = this.getRecurringPattern();
		}

		const taskId = formData.get('taskId');
		const isEditing = !!taskId; // true if taskId exists, false otherwise

		try {
			UIManager.showThrobber(isEditing ? 'Updating task' : 'Adding task');
			let result;

			if (isEditing) {
				const existingTask = DataManager.getTaskById(taskId);
				
				const changedFields = {};
				if (existingTask.title !== taskData.title) {
					changedFields.title = taskData.title;
				}
				if (existingTask.description !== taskData.description) {
					changedFields.description = taskData.description;
				}
				
				// Add other fields here if you extend your backend table/API
				// if (existingTask.description !== taskData.description) { changedFields.description = taskData.description; }
				// etc.

				if (Object.keys(changedFields).length === 0) {
					UIManager.showMessage('No changes detected', 'info');
					UIManager.hideTaskForm();
					return;
				}

				// Call APIManager.updateTask directly with taskId and the changedFields object
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
		const recurringPattern = this.getRecurringPattern('edit');
		try {
			UIManager.showThrobber('Updating recurring pattern');
			const result = await APIManager.updateTask(taskId, {
							recurring: recurringPattern
						});
			if (result.message === 'Task updated successfully' && result.task) {
				DataManager.updateTask(result.task);
				UIManager.updateTaskElement(taskId, result.task);
				UIManager.hideRecurringEditForm();
			}
		} catch (error) {
			UIManager.showErrorMessage(error, 'updating recurring pattern');
		} finally {
			UIManager.hideThrobber('Updating recurring pattern');
		}
	},
	
	getRecurringPattern(prefix = '') {
		const patternId = prefix ? `${prefix}RecurringPattern` : 'recurringPattern';
		const customIntervalId = prefix ? `${prefix}CustomInterval` : 'customInterval';
		const customUnitId = prefix ? `${prefix}CustomUnit` : 'customUnit';
		const recurringEndName = prefix ? `${prefix}RecurringEnd` : 'recurringEnd';
		const occurenceCountId = prefix ? `${prefix}OccurenceCount` : 'occurenceCount';
		const endDateId = prefix ? `${prefix}EndDate` : 'endDate';
		const patternElement = document.getElementById(patternId);
		if (!patternElement) {
			console.error(`Pattern element not found with ID: ${patternId}`);
			return null;
		}
		const pattern = patternElement.value;

		if (pattern === 'none')	return {};
		const recurringData = {
			pattern: pattern,
			interval: pattern === 'custom' ? {
				value: parseInt(document.getElementById(customIntervalId)?.value || '1'),
				unit: document.getElementById(customUnitId)?.value || 'days'
			}
			 : pattern === 'weekday' ? {
				weekdays: true
			}
			 : null,
			end: {
				type: document.querySelector(`input[name="${recurringEndName}"]:checked`)?.value ||
				'never',
				value: null
			}
		};
		if (recurringData.end.type === 'after') {
			const occurenceCount = document.getElementById(occurenceCountId);
			recurringData.end.value = occurenceCount ? parseInt(occurenceCount.value) : 1;
		} else if (recurringData.end.type === 'on') {
			const endDate = document.getElementById(endDateId);
			recurringData.end.value = endDate ? endDate.value : null;
		}
		return recurringData;
	},
	
	selectCategory(category) {
		DataManager.setCurrentCategory(category);
		this.renderTasks();
		UIManager.updateCategorySelection(category);
	},
	
};
							
const INGRESS_PATH_PREFIX = window.location.pathname.replace(/\/$/, '');
const API_BASE_URL = `${INGRESS_PATH_PREFIX}/api`;

const APIManager = {
    // Helper function to handle common fetch logic (error handling, JSON parsing)
    _fetch: async function (url, options = {}) {
        try {
            const response = await fetch(url, options);

            // If the response is not OK (e.g., 404, 500), throw an error
            if (!response.ok) {
                // Try to parse error message from response body if available
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorBody.error || errorBody.message}`);
            }

            // For DELETE requests, the backend might not send a body, so handle accordingly
            if (options && options.method === 'DELETE') {
				try {
					return await response.json();
				} catch {
					return { message: 'Deleted with no response body' };
				}
            }

            // Parse JSON response for other methods
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            // Re-throw to allow calling functions to handle it
            throw error;
        }
    },

    getTasks: async function () {
        console.log('Fetching tasks...');
        return this._fetch(`${API_BASE_URL}/tasks`, {
            method: 'GET'
        });
    },

    addTask: async function (taskData) {
        console.log('Adding task:', taskData);
        return this._fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
    },

    updateTask: async function (taskId, updates) {
        console.log(`Updating task ${taskId} with:`, updates);
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'PUT', // Or PATCH, but PUT is fine here for full replacement or partial update
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
    },

    deleteTask: async function (taskId) {
        console.log('Deleting task:', taskId);
        return this._fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE'
        });
    }
};

const UIManager = {
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
		MULE.Throbber.show(context, {
			mode: 'inline',
			position: 'bottom-right',
			animation: 'bounce',
			dotCount: 4,
			message: `${context}...`
		});
	},
	
	hideThrobber: function (context) {
		MULE.Throbber.hide(context);
	},

	showMessage: function (message, type = 'default') {
		MULE.Snackbar.show(message, {
			type: type
		});
	},
	
	showErrorMessage: function (message, context) {
		MULE.Snackbar.show(`Error ${context.toLowerCase()}: ${message}`, {
			type: 'error'
		});
		console.error(`Error ${context.toLowerCase()}:`, message);
	},
	
	showSuccessMessage: function (message) {
		MULE.Snackbar.show(message, {
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

		const recurringIndicator = taskElement.querySelector('.recurring-indicator');
		if (!recurringIndicator) {
			console.error('No recurring data found for task:', taskId);
			return;
		}
		let recurringData;
		try {
			const rawData = recurringIndicator.getAttribute('data-recurring');
			recurringData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
		} catch (e) {
			console.error('Error parsing recurring data:', e);
			return;
		}
		// Set up the form with the current recurring pattern
		document.getElementById('editRecurringTaskId').value = taskId;
		document.getElementById('editRecurringPattern').value = recurringData.pattern || 'daily';
		// Handle custom pattern
		const customRepeatDiv = document.querySelector('#recurringEditModal .custom-repeat');
		if (recurringData.pattern === 'custom' && recurringData.interval) {
			document.getElementById('editCustomInterval').value = recurringData.interval.value || 1;
			document.getElementById('editCustomUnit').value = recurringData.interval.unit || 'days';
			customRepeatDiv.style.display = 'block';
		} else {
			customRepeatDiv.style.display = 'none';
		}
		// Handle end options
		const endType = recurringData.end ? recurringData.end.type : 'never';
		const endRadio = document.querySelector(`#recurringEditModal input[name="editRecurringEnd"][value="${endType}"]`);
		if (endRadio) {
			endRadio.checked = true;
		}
		const occurenceCount = document.getElementById('editOccurenceCount');
		const endDate = document.getElementById('editEndDate');
		occurenceCount.disabled = endType !== 'after';
		endDate.disabled = endType !== 'on';

		if (recurringData.end) {
			if (endType === 'after') {
				occurenceCount.value = recurringData.end.value || 1;
			} else if (endType === 'on') {
				endDate.value = recurringData.end.value || '';
			}
		}
		document.getElementById('recurringEditModal').style.display = 'block';
	},
	
	hideRecurringEditForm: function () {
		document.getElementById('recurringEditModal').style.display = 'none';
	},
	
	createTaskHTML: function (task) {
		const taskData = {
			title: task.title || 'Untitled Task',
			description: task.description || '',
			dueDate: task.dueDate || '',
			status: task.status || 'Not Started',
			priority: task.priority || 'Low',
			progress: task.progress || 0,
			category: task.category || '',
			recurring: task.recurring || {}
		};
		const recurringDescription = Object.keys(taskData.recurring).length ?
			this.getRecurringDescription(taskData.recurring) : '';
		const recurringIndicator = JSON.stringify(task.recurring) !== "{}" ?
			`<span class="recurring-indicator" data-recurring='${JSON.stringify(taskData.recurring)}'title="${recurringDescription}" onclick="UIManager.showRecurringEditForm('${task.id}', event)">🔁</span>` : '';
		const html = `
			<div class="task-item" data-task-id="${task.id}">
				<div class="task-expand-indicator ${task.hasSubtasks ? '' : 'hidden'}" onclick="UIManager.toggleSubtasks('${task.id}', event)"></div>
				<div class="task-content">

					<div class="task-header">
						${recurringIndicator}
						<div class="title-container">
							<span class="task-title" onclick="UIManager.editTaskTitle(event, '${task.id}')">${taskData.title}</span>
							<input type="text" class="title-edit" value="${taskData.title}" style="display: none" onblur="TaskManager.updateTitle(event, '${task.id}')"	onkeydown="if(event.key==='Enter')this.blur(); if(event.key==='Escape') UIManager.finishTitleEdit(event.target.closest('.title-container'))">
						</div>
	  
						<div class="task-details">
							<div class="task-meta">
								<span class="meta-item due-date-container">
									<span class="meta-label">Due:</span>
									<span class="meta-value due-date" onclick="UIManager.editTaskDueDate(event,	'${task.id}')" data-raw-date="${taskData.dueDate || ''}">
										${taskData.dueDate ? taskData.dueDate.split('T')[0] : 'None'}
									</span>
									<div class="date-picker-dropdown" style="display: none;">
										<div class="date-picker-header">
											<span class="clear-date" onclick="UIManager.clearDueDate(event, '${task.id}')">Clear</span>
											<span class="quick-dates">
												<span onclick="UIManager.setQuickDate(event, '${task.id}', 'today')">Today</span>
												<span onclick="UIManager.setQuickDate(event, '${task.id}', 'tomorrow')">Tomorrow</span>
												<span onclick="UIManager.setQuickDate(event, '${task.id}', 'nextWeek')">Next Week</span>
											</span>
										</div>
										<input type="date" class="date-input" value="${taskData.dueDate ? taskData.dueDate.split('T')[0] : ''}"	onchange="TaskManager.updateDueDate(event, '${task.id}')" onclick="event.stopPropagation()">
									</div>
								</span>
								<span class="meta-item">
									<span class="meta-label">Status:</span>
									<span class="meta-value status">${taskData.status}</span>
								</span>
								<span class="meta-item">
									<span class="meta-label">Complete:</span>
									<span class="meta-value progress">${taskData.progress}%</span>
								</span>
							</div>

							<div class="progress-bar">
								<div class="progress" style="width: ${taskData.progress}%"></div>
							</div>
						</div>
						<div class="priority-container">
							<div class="priority priority-${taskData.priority}"	onclick="UIManager.togglePriorityDropdown(event, '${task.id}')">
								${taskData.priority}
							</div>
							<div class="priority-dropdown" style="display: none;">
								<div class="priority-option priority-Low" onclick="TaskManager.updatePriority(event, '${task.id}', 'Low')">Low</div>
								<div class="priority-option priority-Medium" onclick="TaskManager.updatePriority(event, '${task.id}', 'Medium')">Medium</div>
								<div class="priority-option priority-High" onclick="TaskManager.updatePriority(event, '${task.id}', 'High')">High</div>
							</div>
						</div>
					</div>
				<div class="description-container">
					<div class="description" onclick="UIManager.editTaskDescription(event, '${task.id}')">
						${taskData.description || '<span class="placeholder">Add description...</span>'}
					</div>
					<textarea class="description-edit" style="display: none" onblur="TaskManager.updateDescription(event, '${task.id}')" onkeydown="if(event.key==='Escape') UIManager.finishDescriptionEdit(event.target.closest('.description-container'))">${taskData.description}</textarea>
				</div>
			</div>
			<div class="task-actions">
				<button class="btn btn-info btn-sm"	onclick="UIManager.showTaskForm('${task.id}')">Add</button>
				<button class="btn btn-success btn-sm" onclick="TaskManager.updateTaskStatus(event,	'${task.id}', 'Completed')">Done</button>
				<button class="btn btn-delete btn-sm" onclick="TaskManager.deleteTask('${task.id}')">Delete</button>
			</div>
		</div>
			`;
		return html;
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
		if (JSON.stringify(updatedTask.recurring) !== "{}") {
			if (!recurringIndicator) {
				// Create recurring indicator if it doesn't exist
				const newRecurringIndicator = document.createElement('span');
				newRecurringIndicator.className = 'recurring-indicator';
				newRecurringIndicator.textContent = '🔁';
				newRecurringIndicator.onclick = (event) => TaskManager.editRecurringPattern(taskId,
					event);
				const taskHeader = taskElement.querySelector('.task-header');
				if (taskHeader) {
					taskHeader.insertBefore(newRecurringIndicator, taskHeader.firstChild);
				}
			}
			// Update recurring data and description
			const recurringData = typeof updatedTask.recurring === 'string' ?
				updatedTask.recurring :
				JSON.stringify(updatedTask.recurring);
			(recurringIndicator || taskElement.querySelector('.recurring-indicator')).setAttribute('data-recurring', recurringData);
			(recurringIndicator || taskElement.querySelector('.recurring-indicator')).setAttribute('title',	this.getRecurringDescription(updatedTask.recurring));
		} else if (recurringIndicator) {
			// Remove recurring indicator if task is no longer recurring
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
		const taskContainer = document.createElement('div');
		taskMap.forEach(task => {
			if (!task.parentTaskId) {
				const taskElement = document.createElement('div');
				taskElement.className = `task-container category-${task.category || 'none'}`;
				taskElement.setAttribute('data-task-id', task.id);
				taskElement.innerHTML = this.createTaskHTML(task);
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
				taskElement.innerHTML = this.createTaskHTML(task);
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
		console.log('Adding task to UI:', task);
		const taskElement = document.createElement('div');
		taskElement.className = `task-container category-${task.category || 'none'}`;
		taskElement.setAttribute('data-task-id', task.id);
		taskElement.innerHTML = this.createTaskHTML(task);
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
		if (!recurring)	return '';
		let recurringData = recurring;
		
		if (typeof recurring === 'string') {
			try {
				recurringData = JSON.parse(recurring);
			} catch (e) {
				console.error('Error parsing recurring data:', e);
				return 'Recurring task';
			}
		}
		
		let description = 'Repeats ';
		switch (recurringData.pattern) {
		case 'daily':
			description += 'daily';
			break;
		case 'weekday':
			description += 'every weekday';
			break;
		case 'weekly':
			description += 'weekly';
			break;
		case 'biweekly':
			description += 'every 2 weeks';
			break;
		case 'monthly':
			description += 'monthly';
			break;
		case 'yearly':
			description += 'yearly';
			break;
		case 'custom':
			if (recurringData.interval) {
				description += `every ${recurringData.interval.value} ${recurringData.interval.unit}`;
			} else {
				description += 'with custom pattern';
			}
			break;
		default:
			description += 'with unknown pattern';
		}
		
		if (recurringData.end) {
			if (recurringData.end.type === 'after') {
				description += `, ${recurringData.end.value} times`;
			} else if (recurringData.end.type === 'on' && recurringData.end.value) {
				description += `, until ${recurringData.end.value}`;
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
		const filterContainer = document.getElementById('filterContainer');
		const toggleButton = document.getElementById('toggleFilters');
		filterContainer.classList.toggle('expanded');
		toggleButton.textContent = filterContainer.classList.contains('expanded') ? 'Filters ▲' :
			'Filters ▼';
	},
	
};

const DataManager = {
	state: {
		tasks: [],
		currentCategory: 'All',
		categories: ['All', 'Work', 'Personal', 'Shopping', 'Health'],
		currentFilters: {
			status: 'active',
			priority: 'all',
			dueDate: 'all'
		},
		currentSort: 'dueDate-asc'
	},
	
	init: function () {
		this.loadState();
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
					...parsedState // Override with saved values
				};
			} catch (error) {
				console.error('Error loading saved state:', error);
			}
		}
	},
	
	setState: function (newState) {
		this.state = {
			...this.state,
			...newState
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
		const index = this.state.tasks.findIndex(t => t.id === taskId);
		if (index !== -1) {
			this.state.tasks.splice(index, 1);
		}
	},
	
	getTaskById(taskId) {
		return this.state.tasks.find(task => task.id === taskId);
	},
	
	updateTask: function (task) {
		const index = this.state.tasks.findIndex(t => t.id === task.id);

		if (index !== -1) {
			this.state.tasks[index] = task;
			this.saveState();
		}
	},

	deleteTask: function (task) {
		const index = this.state.tasks.findIndex(t => t.id === task.id);

		if (index !== -1) {
			this.state.tasks.splice(index, 1);
			this.saveState();
		}
	},
	
	getFilteredAndSortedTasks: function () {
		const tasks = Array.isArray(this.state.tasks) ? this.state.tasks : [];
		let filteredTasks = this.filterTasks(tasks);
		const sortedTasks = this.sortTasks(filteredTasks);
		return sortedTasks;
	},
	
	filterTasks: function (tasks) {
		// Add safety check
		if (!Array.isArray(tasks)) {
			console.error('Expected tasks to be an array:', tasks);
			return [];
		}
		return tasks.filter(task => {
			// Category filter
			if (this.state.currentCategory !== 'All' && task.category !== this.state.currentCategory) {
				return false;
			}
			// Status filter
			if (this.state.currentFilters.status !== 'all') {
				const isCompleted = task.status === 'Completed';
				if (this.state.currentFilters.status === 'active' && isCompleted)
					return false;
				if (this.state.currentFilters.status === 'completed' && !isCompleted)
					return false;
			}
			// Priority filter
			if (this.state.currentFilters.priority !== 'all' && task.priority !==
				this.state.currentFilters.priority) {
				return false;
			}
			// Due date filter
			if (this.state.currentFilters.dueDate !== 'all' && task.dueDate) {
				const taskDate = new Date(task.dueDate);
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				switch (this.state.currentFilters.dueDate) {
				case 'today':
					if (taskDate.getTime() !== today.getTime())
						return false;
					break;
				case 'week':
					const weekFromNow = new Date(today);
					weekFromNow.setDate(weekFromNow.getDate() + 7);
					if (taskDate < today || taskDate > weekFromNow)
						return false;
					break;
				case 'overdue':
					if (taskDate >= today)
						return false;
					break;
				}
			}
			return true;
		});
	},
	
	updateFilters: function (filters) {
		this.state.currentFilters = {
			...this.state.currentFilters,
			...filters
		};
		if (filters.sort) {
			this.state.currentSort = filters.sort;
		}
		this.saveState();
	},
	
	sortTasks: function (tasks) {
		const [field, direction] = this.state.currentSort.split('-');
		return [...tasks].sort((a, b) => {
			let comparison = 0;
			switch (field) {
			case 'dueDate':
				if (!a.dueDate && !b.dueDate)
					comparison = 0;
				else if (!a.dueDate)
					comparison = 1;
				else if (!b.dueDate)
					comparison = -1;
				else
					comparison = new Date(a.dueDate) - new Date(b.dueDate);
				break;

			case 'priority':
				const priorityOrder = {
					High: 3,
					Medium: 2,
					Low: 1
				};
				comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
				break;
			case 'name':
				comparison = (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
				break;
			default:
				if (!a.dueDate && !b.dueDate)
					comparison = 0;
				else if (!a.dueDate)
					comparison = 1;
				else if (!b.dueDate)
					comparison = -1;
				else
					comparison = new Date(a.dueDate) - new Date(b.dueDate);
			}
			return direction === 'desc' ? -comparison : comparison;
		});
	},
	
	setCurrentCategory: function (category) {
		this.state.currentCategory = category;
		this.saveState();
	},
};
	
const FilterManager = {
	filters: {
		status: ['all', 'active', 'completed'],
		priority: ['all', 'High', 'Medium', 'Low'],
		dueDate: ['all', 'today', 'week', 'overdue']
	},
	
	setupFilters: function () {
		const statusFilter = document.getElementById('statusFilter');
		const priorityFilter = document.getElementById('priorityFilter');
		const dueDateFilter = document.getElementById('dueDateFilter');
		const sortBy = document.getElementById('sortBy');
		// Set initial values from saved state
		statusFilter.value = DataManager.state.currentFilters.status;
		priorityFilter.value = DataManager.state.currentFilters.priority;
		dueDateFilter.value = DataManager.state.currentFilters.dueDate;

		sortBy.value = DataManager.state.currentSort;
		[statusFilter, priorityFilter, dueDateFilter, sortBy].forEach(filter => {
			filter.addEventListener('change', () => {
				DataManager.updateFilters({
					status: statusFilter.value,
					priority: priorityFilter.value,
					dueDate: dueDateFilter.value,
					sort: sortBy.value
				});
				TaskManager.renderTasks();
			});
		});
	},
	
	applyFilters(filters) {
		DataManager.state.currentFilters = filters;
		TaskManager.renderTasks();
	},
	
};

// Initialize the TaskManager
document.addEventListener('DOMContentLoaded', () => {
    TaskManager.init().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});
