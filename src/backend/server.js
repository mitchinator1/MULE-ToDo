const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Use verbose for more detailed logging
const cors = require('cors'); // Import cors

const app = express();
const PORT = process.env.PORT || 3000; // Use port 3000 by default

app.use(cors()); // Enable CORS for all routes (important for development)
app.use(express.json()); // Enable parsing of JSON request bodies

// Connect to SQLite database. The .db file will be created if it doesn't exist.
const db = new sqlite3.Database('./todo.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create the tasks table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			description TEXT DEFAULT '',
            dueDate TEXT DEFAULT '',           -- Storing dates as TEXT (ISO 8601 format) is common with SQLite
            priority TEXT DEFAULT 'Low',
            status TEXT DEFAULT 'Not Started',
            parentTaskId INTEGER DEFAULT '',
            category TEXT DEFAULT '',
            progress INTEGER DEFAULT 0,
			recurring TEXT DEFAULT ''
        )`, (createErr) => {
            if (createErr) {
                console.error('Error creating table:', createErr.message);
            } else {
                console.log('Tasks table ensured.');
            }
        });
    }
});

const processTaskRow = (row) => {
    if (row && row.recurring) { // Check if row exists and has a recurring property
        try {
            // Attempt to parse the recurring string into a JSON object
            row.recurring = JSON.parse(row.recurring);
        } catch (e) {
            console.error('Error parsing recurring JSON for task ID:', row.id, e);
            // If parsing fails, default to an empty object or handle as needed
            row.recurring = {};
        }
    } else if (row) {
        // If recurring property is null or empty string, ensure it's an empty object for frontend consistency
        row.recurring = {};
    }
    return row; // Return the modified row
};

// 1. GET all tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(processTaskRow));
    });
});

// 2. GET a single task by ID
app.get('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        res.json(processTaskRow(row));
    });
});

// 3. POST a new task
app.post('/api/tasks', (req, res) => {
    const { title, description, dueDate, priority, status, parentTaskId, category, progress, recurring } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }
	
	const columns = ['title', 'description', 'dueDate', 'priority', 'status', 'parentTaskId', 'category', 'progress'];
    const placeholders = Array(columns.length).fill('?');
    const values = [title, description, dueDate, priority, status, parentTaskId, category, progress];
	
	const filteredColumns = [];
    const filteredPlaceholders = [];
    const filteredValues = [];
	
	if (recurring !== undefined && recurring !== null && typeof recurring === 'object') {
        filteredColumns.push('recurring');
        filteredPlaceholders.push('?');
        filteredValues.push(JSON.stringify(recurring)); // Stringify the object
    }
	
	for (let i = 0; i < columns.length; i++) {
        // Only include if value is not undefined (i.e., it was explicitly sent in the request body)
        // Note: Empty strings are still valid data for the database
        if (values[i] !== undefined) {
            filteredColumns.push(columns[i]);
            filteredPlaceholders.push(placeholders[i]);
            filteredValues.push(values[i]);
        }
    }

    // Add other fields if they are provided in the request body
    if (description !== undefined) { columns.push('description'); placeholders.push('?'); values.push(description); }
    if (dueDate !== undefined) { columns.push('dueDate'); placeholders.push('?'); values.push(dueDate); }
    if (priority !== undefined) { columns.push('priority'); placeholders.push('?'); values.push(priority); }
    if (status !== undefined) { columns.push('status'); placeholders.push('?'); values.push(status); }
    if (parentTaskId !== undefined) { columns.push('parentTaskId'); placeholders.push('?'); values.push(parentTaskId); }
    if (category !== undefined) { columns.push('category'); placeholders.push('?'); values.push(category); }
    if (progress !== undefined) { columns.push('progress'); placeholders.push('?'); values.push(progress); }
	
    db.run(`INSERT INTO tasks (${filteredColumns.join(', ')}) VALUES (${filteredPlaceholders.join(', ')})`, filteredValues, function(err) {
        if (err) {
			console.error('Error inserting task:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        // Return the newly created task with its ID
        const newTaskId = this.lastID;
        db.get('SELECT * FROM tasks WHERE id = ?', [newTaskId], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json(processTaskRow(row)); // Send the full new task object back
        });
    });
});

// 4. PUT/PATCH update an existing task (e.g., toggle completed status or update title)
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { title, completed, description, dueDate, priority, status, parentTaskId, category, progress, recurring } = req.body;

    let updates = [];
    let params = [];
    let sql = 'UPDATE tasks SET ';

    if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
    }
    if (completed !== undefined) {
        updates.push('completed = ?');
        params.push(completed ? 1 : 0); // SQLite stores booleans as 0 or 1
    }
	if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }
    if (dueDate !== undefined) {
        updates.push('dueDate = ?');
        params.push(dueDate);
    }
    if (priority !== undefined) {
        updates.push('priority = ?');
        params.push(priority);
    }
    if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
    }
    if (parentTaskId !== undefined) {
        updates.push('parentTaskId = ?');
        params.push(parentTaskId);
    }
    if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
    }
    if (progress !== undefined) {
        updates.push('progress = ?');
        params.push(progress);
    }
	if (recurring !== undefined) {
        updates.push('recurring = ?');
        if (recurring === null || typeof recurring !== 'object') { // Allow clearing recurring or invalid data
            params.push(''); // Save as empty string or NULL if not an object
        } else {
            params.push(JSON.stringify(recurring)); // Stringify the object
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update provided' });
    }

    sql += updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ message: 'Task not found or no changes made' });
            return;
        }
		const updatedTaskId = id;
		db.get('SELECT * FROM tasks WHERE id = ?', [updatedTaskId], (err, row) => {
			if (err) { 
				res.status(500).json({ error: err.message });
                return;			
			}
			if (!row) { /* ... not found for retrieval handling ... */ }
			res.json({ message: 'Task updated successfully', task: processTaskRow(row) });
		});
    });
});

// 5. DELETE a task
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        res.json({ message: 'Task deleted successfully', changes: this.changes });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}/api/tasks`);
});

// Close the database connection when the Node.js process exits
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
