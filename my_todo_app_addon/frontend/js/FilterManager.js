import { DataManager } from "./DataManager.js";

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

export default FilterManager;