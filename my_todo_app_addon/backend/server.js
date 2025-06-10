console.log("SERVER.JS: STARTING EXECUTION");

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 3000;
const BIND_IP = '0.0.0.0';

app.use(cors()); // Enable CORS for all routes (important for development)
app.use(express.json()); // Enable parsing of JSON request bodies

// MQTT Configuration
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_PORT = process.env.MQTT_PORT ? parseInt(process.env.MQTT_PORT) : 1883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
let mqttClient; // Declare mqttClient globally

// Home Assistant MQTT Discovery topic prefix
const HA_DISCOVERY_PREFIX = 'homeassistant';
const ADDON_SLUG = 'my_todo_app'; // Match your add-on slug

// Define the discovery payload for an "upcoming tasks" sensor
const UPCOMING_TASKS_SENSOR_CONFIG_TOPIC = `${HA_DISCOVERY_PREFIX}/sensor/${ADDON_SLUG}/upcoming_tasks/config`;
const UPCOMING_TASKS_SENSOR_STATE_TOPIC = `${ADDON_SLUG}/sensor/upcoming_tasks/state`;
const UPCOMING_TASKS_SENSOR_ATTRIBUTES_TOPIC = `${ADDON_SLUG}/sensor/upcoming_tasks/attributes`; // Optional: for more detailed data

const UPCOMING_TASKS_SENSOR_CONFIG_PAYLOAD = {
    name: "Upcoming To-Do Tasks",
    unique_id: `${ADDON_SLUG}_upcoming_tasks`,
    state_topic: UPCOMING_TASKS_SENSOR_STATE_TOPIC,
    json_attributes_topic: UPCOMING_TASKS_SENSOR_ATTRIBUTES_TOPIC, // Use this for a list of tasks
    unit_of_measurement: "tasks",
    icon: "mdi:calendar-check",
    device: { // Optional: Create a device in HA for your add-on
        identifiers: [`${ADDON_SLUG}_device`],
        name: "My To-Do App",
        model: "To-Do Add-on",
        manufacturer: "MULE",
        sw_version: process.env.ADDON_VERSION || "unknown" // Get version from HA supervisor environment if available
    }
};

// Connect to SQLite database. The .db file will be created if it doesn't exist.
const db = new sqlite3.Database('/data/todo.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
	process.exit(1);
    } else {
        console.log('Connected to the SQLite database.');
        // Create the tasks table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			description TEXT DEFAULT '',
            dueDate TEXT DEFAULT '',
            priority TEXT DEFAULT 'Low',
            status TEXT DEFAULT 'Not Started',
            parentTaskId INTEGER DEFAULT '',
            category TEXT DEFAULT '',
            progress INTEGER DEFAULT 0,
			recurring TEXT DEFAULT ''
        )`, (createErr) => {
            if (createErr) {
                console.error('Error creating table:', createErr.message);
		process.exit(1);
            } else {
                console.log('Tasks table ensured.');
		connectMqttAndStartServer();
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

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// --- MQTT Connection and Publishing Logic ---
function connectMqttAndStartServer() {
    const mqttOptions = {
        port: MQTT_PORT,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        clientId: `${ADDON_SLUG}_${Math.random().toString(16).substring(2, 8)}` // Unique client ID
    };

    console.log(`MQTT Connection Attempt: Broker=${MQTT_BROKER}, Port=${MQTT_PORT}`);

    mqttClient = mqtt.connect(`mqtt://${MQTT_BROKER}`, mqttOptions);

    mqttClient.on('connect', () => {
        console.log('MQTT Connected.');
        // Publish discovery message
        mqttClient.publish(UPCOMING_TASKS_SENSOR_CONFIG_TOPIC, JSON.stringify(UPCOMING_TASKS_SENSOR_CONFIG_PAYLOAD), { retain: true });
        console.log('Published MQTT Discovery for Upcoming Tasks Sensor.');

        // Initial state update
        publishUpcomingTasksState();

        // Start periodic updates (e.g., every 5 minutes)
        setInterval(publishUpcomingTasksState, 5 * 60 * 1000); // 5 minutes
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT Error:', err);
        // Do not exit on MQTT error, just log. The app can still run.
    });

    mqttClient.on('offline', () => {
        console.warn('MQTT client went offline.');
    });

    mqttClient.on('reconnect', () => {
        console.log('MQTT client reconnected.');
    });

    // Start the Express server - THIS WAS MISSING ITS WRAPPER IN YOUR PROVIDED CODE
    const httpServer = app.listen(PORT, BIND_IP, () => {
        console.log(`Server running on ${BIND_IP}:${PORT}`);
        console.log(`API will be accessible via ingress`);
        console.log("SERVER.JS: HTTP server successfully listening.");
    });

    console.log("SERVER.JS: app.listen() call completed. Process should now be kept alive by server.");

    httpServer.on('error', (err) => {
        console.error('HTTP Server Error (from event listener):', err.message, err.stack);
        process.exit(1);
    });

    httpServer.on('close', () => {
        console.log('HTTP Server Closed (from event listener).');
    });

}

// Function to calculate and publish upcoming tasks state
function publishUpcomingTasksState() {
    if (!db || !mqttClient || !mqttClient.connected) {
        console.warn("Cannot publish MQTT state: DB not ready or MQTT not connected.");
        return;
    }

    db.all(`SELECT id, title, description, dueDate, priority, status, category, progress FROM tasks WHERE completed = 0 AND dueDate IS NOT NULL AND dueDate != ""`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching tasks for MQTT state:', err.message);
            mqttClient.publish(UPCOMING_TASKS_SENSOR_STATE_TOPIC, "0", { retain: false });
            console.log(`Published upcoming tasks count: 0 (due to error)`);
            mqttClient.publish(UPCOMING_TASKS_SENSOR_ATTRIBUTES_TOPIC, "[]", { retain: false }); // Publish empty array on error
            return;
        }

        const now = new Date();
        const upcomingTasks = [];

        rows.forEach(task => {
            try {
                const taskDueDate = new Date(task.dueDate);
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                if (taskDueDate >= now && taskDueDate <= sevenDaysFromNow) {
                    upcomingTasks.push({
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        dueDate: task.dueDate,
                        priority: task.priority,
                        status: task.status,
                        category: task.category,
                        progress: task.progress
                        // We are not including the following yet: 'completed', 'created_at', 'parentTaskId', 'recurring'
                    });
                }
            } catch (dateError) {
                console.error(`Error parsing dueDate for task ${task.id}: ${task.dueDate}, Error: ${dateError.message}`);
            }
        });

	upcomingTasks.sort((a, b) => {
	    const dateA = new Date(a.dueDate);
	    const dateB = new Date(b.dueDate);
	    if (dateA - dateB !== 0) {
	        return dateA - dateB;
	    }
	    return a.id - b.id;
	});

        const count = upcomingTasks.length;
	const nextDueId = count > 0 ? upcomingTasks[0].id : null;
        mqttClient.publish(UPCOMING_TASKS_SENSOR_STATE_TOPIC, String(count), { retain: false });
        console.log(`Published upcoming tasks count: ${count}`);

        // --- Publish the detailed attributes as JSON ---
        mqttClient.publish(
	  UPCOMING_TASKS_SENSOR_ATTRIBUTES_TOPIC,
	  JSON.stringify({
	    count: upcomingTasks.length,
	    next_due_id: nextDueId,
	    tasks: upcomingTasks
	  }),
	  { retain: false }
	);
        console.log(`Published upcoming tasks attributes: ${JSON.stringify(upcomingTasks)}`);
    });
}
const debouncedPublishUpcomingTasksState = debounce(publishUpcomingTasksState, 5000);

app.use(express.static('/app/frontend'));

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
	    debouncedPublishUpcomingTasksState();
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
		if (!row) { /* ... not found for retrieval handling ... */ } // TODO
		debouncedPublishUpcomingTasksState();
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
	    debouncedPublishUpcomingTasksState();
        res.json({ message: 'Task deleted successfully', changes: this.changes });
    });
});

// Global error handlers (important for debugging)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message, err.stack);
    process.exit(1);
});

// Close the database connection when the Node.js process exits
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        // Disconnect MQTT client before exiting
        if (mqttClient && mqttClient.connected) {
            mqttClient.end(() => {
                console.log('MQTT client disconnected.');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});
