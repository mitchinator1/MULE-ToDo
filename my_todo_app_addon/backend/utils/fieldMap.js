const fieldMap = {
    title: 'title',
    completed: 'completed',
    description: 'description',
    dueDate: 'due_date',
    priority: 'priority',
    status: 'status',
    parentTaskId: 'parent_task_id',
    categoryId: 'category_id',
    recurring: 'recurring'
};

const reverseFieldMap = Object.fromEntries(
    Object.entries(fieldMap).map(([key, value]) => [value, key])
);

module.exports = { fieldMap, reverseFieldMap };