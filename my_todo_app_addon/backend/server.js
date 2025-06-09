console.log("SERVER.JS: STARTING EXECUTION");

const express = require('express');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const mqtt = require('mqtt');
const util = require('util');

const app = express();
const server = http.createServer(app);

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
    device: {
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

// Promisify db methods for async/await
db.all = util.promisify(db.all);
db.get = util.promisify(db.get);
db.runAsync = function (sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

const processTaskRow = (row) => {
    if (row && row.recurring) {
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
    server.listen(PORT, BIND_IP, () => {
        console.log(`Server running on ${BIND_IP}:${PORT}`);
        console.log(`Access at: http://homeassistant.local/hassio/ingress/my_todo_app`);
        console.log(`API will be accessible via ingress`);
        console.log("SERVER.JS: HTTP server successfully listening.");
    });

    console.log("SERVER.JS: app.listen() call completed. Process should now be kept alive by server.");

    server.on('error', (err) => {
        console.error('HTTP Server Error (from event listener):', err.message, err.stack);
        process.exit(1);
    });

    server.on('close', () => {
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
app.get('/api/tasks', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM tasks', []);
        res.json(rows.map(processTaskRow));
    } catch (err) {
        console.error('Error getting tasks:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. GET a single task by ID
app.get('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
        if (!row) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        res.json(processTaskRow(row));
    } catch (err) {
        console.error('Error getting single task:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. POST a new task
app.post('/api/tasks', async (req, res) => {
    const { title, description, dueDate, priority, status, parentTaskId, category, progress, recurring } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
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
        filteredValues.push(JSON.stringify(recurring)); // Stringify the object for DB storage
    }

    for (let i = 0; i < columns.length; i++) {
        if (values[i] !== undefined) {
            filteredColumns.push(columns[i]);
            filteredPlaceholders.push(placeholders[i]);
            filteredValues.push(values[i]);
        }
    }

    try {
        const result = await db.runAsync(`INSERT INTO tasks (${filteredColumns.join(', ')}) VALUES (${filteredPlaceholders.join(', ')})`, filteredValues);
        const newTaskId = result.lastID;
        const rawNewTask = await db.get('SELECT * FROM tasks WHERE id = ?', [newTaskId]); // Get the raw task from DB

        // --- FIX: Process the task row ONCE and store it ---
        const processedNewTask = processTaskRow(rawNewTask);

        debouncedPublishUpcomingTasksState();

        mqttClient.publish('task_created', JSON.stringify(processedNewTask), { retain: false });
        console.log('Emitted WebSocket event: taskCreated', processedNewTask.title);

        res.status(201).json(processedNewTask); // Send the already processed task
    } catch (err) {
        console.error('Error creating task:', err.message);
        res.status(500).json({ error: 'Failed to create task.' });
    }
});

// 4. PUT/PATCH update an existing task
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { title, completed, description, dueDate, priority, status, parentTaskId, category, progress, recurring } = req.body;

    let updates = [];
    let params = [];
    let sql = 'UPDATE tasks SET ';

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (completed !== undefined) { updates.push('completed = ?'); params.push(completed ? 1 : 0); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (dueDate !== undefined) { updates.push('dueDate = ?'); params.push(dueDate); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (parentTaskId !== undefined) { updates.push('parentTaskId = ?'); params.push(parentTaskId); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    if (recurring !== undefined) {
        updates.push('recurring = ?');
        if (recurring === null || typeof recurring !== 'object') {
            params.push(''); // Save as empty string or NULL if not an object
        } else {
            params.push(JSON.stringify(recurring)); // Stringify the object for DB storage
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update provided' });
    }

    sql += updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    try {
        const result = await db.runAsync(sql, params);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Task not found or no changes made.' });
        }
        const rawUpdatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]); // Get the raw task from DB

        // --- FIX: Process the task row ONCE and store it ---
        const processedUpdatedTask = processTaskRow(rawUpdatedTask);

        debouncedPublishUpcomingTasksState();

        // io.emit('taskUpdated', processedUpdatedTask); // Emit the already processed task
        console.log('Emitted WebSocket event: taskUpdated', processedUpdatedTask.title);

        res.json({ message: 'Task updated successfully', task: processedUpdatedTask }); // Send the already processed task
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// 5. DELETE a task
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        debouncedPublishUpcomingTasksState();

        // io.emit('taskDeleted', id);
        console.log('Emitted WebSocket event: taskDeleted for ID:', id);

        res.json({ message: 'Task deleted successfully', changes: result.changes });
    } catch (err) {
        console.error('Error deleting task:', err.message);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
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
