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
const ADDON_SLUG = 'mule_todo'; // Match your add-on slug

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
    }

    console.log('Connected to the SQLite database.');

    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON');

    // Create tables in sequence
    db.serialize(() => {
        // Categories (nested)
        db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_id INTEGER,
                FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
            )
        `);

        // Tasks
        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT DEFAULT '',
                due_date TEXT DEFAULT '',
                priority TEXT DEFAULT 'Low',
                status TEXT DEFAULT 'Not Started',
                parent_task_id INTEGER,
                category_id INTEGER,
                FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )
        `);

        // Tags
        db.run(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
        `);

        // Task-Tag linking
        db.run(`
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        `);

        // Recurring Rules
        db.run(`
            CREATE TABLE IF NOT EXISTS recurring_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                frequency TEXT NOT NULL,
                interval INTEGER DEFAULT 1,
                by_day TEXT DEFAULT NULL,
                by_month_day TEXT DEFAULT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT DEFAULT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // (Optional) Task History
        db.run(`
            CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                field_changed TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `, (createErr) => {
            if (createErr) {
                console.error('Error creating tables:', createErr.message);
                process.exit(1);
            } else {
                console.log('All tables ensured.');
                connectMqttAndStartServer();
            }
        });
    });
});

const MAX_HISTORY_PER_TASK = 20;

function logTaskHistory(taskId, field, oldValue, newValue) {
    if (oldValue === newValue) return; // skip unchanged values

    db.run(`
        INSERT INTO task_history (task_id, field_changed, old_value, new_value)
        VALUES (?, ?, ?, ?)
    `, [taskId, field, String(oldValue), String(newValue)], function (err) {
        if (err) {
            console.error(`Error logging history for task ${taskId} field '${field}':`, err.message);
        } else {
            db.run(`
                DELETE FROM task_history
                WHERE task_id = ?
                AND id NOT IN (
                    SELECT id FROM task_history
                    WHERE task_id = ?
                    ORDER BY changed_at DESC
                    LIMIT ?
                )
            `, [taskId, taskId, MAX_HISTORY_PER_TASK], (pruneErr) => {
                if (pruneErr) {
                    console.error('Error pruning task history:', pruneErr.message);
                }
            });
        }
    });
}

function processTaskRow(row) {
    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        completed: !!row.completed,
        description: row.description,
        dueDate: row.due_date,
        priority: row.priority,
        status: row.status,
        parentTaskId: row.parent_task_id,
        categoryId: row.category_id,
        recurring: (() => {
            try {
                return row.recurring ? JSON.parse(row.recurring) : {};
            } catch {
                return {};
            }
        })()
    };
}

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

    // Start the Express server
    const httpServer = app.listen(PORT, BIND_IP, () => {
        console.log(`Server running on ${BIND_IP}:${PORT}`);
        console.log("SERVER.JS: HTTP server successfully listening.");
    });

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

    const dbFields = [];
    const placeholders = [];
    const values = [];

    Object.entries(fieldMap).forEach(([inputField, dbField]) => {
        let value = req.body[inputField];

        if (value !== undefined) {
            if (dbField === 'completed') {
                value = value ? 1 : 0;
            } else if (dbField === 'recurring') {
                value = (value === null || typeof value !== 'object') ? '' : JSON.stringify(value);
            }
            dbFields.push(dbField);
            placeholders.push('?');
            values.push(value);
        }
    });

    if (!dbFields.includes('title')) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }

    const sql = `INSERT INTO tasks (${dbFields.join(', ')}) VALUES (${placeholders.join(', ')})`;

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error inserting task:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }

        const newTaskId = this.lastID;
        db.get('SELECT * FROM tasks WHERE id = ?', [newTaskId], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            debouncedPublishUpcomingTasksState();
            res.status(201).json(processTaskRow(row));
        });
    });
});

// 4. PUT/PATCH update an existing task (e.g., toggle completed status or update title)
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;

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

    // Step 1: Fetch the original task to compare changes
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, originalTask) => {
        if (err) {
            res.status(500).json({ error: 'Error fetching task for update' });
            return;
        }
        if (!originalTask) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Step 2: Build updates
        const updates = [];
        const params = [];

        Object.entries(fieldMap).forEach(([inputField, dbField]) => {
            let value = req.body[inputField];
            if (value !== undefined) {
                if (dbField === 'completed') {
                    value = value ? 1 : 0;
                } else if (dbField === 'recurring') {
                    value = (value === null || typeof value !== 'object') ? '' : JSON.stringify(value);
                }
                updates.push(`${dbField} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update provided' });
        }

        const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        // Step 3: Execute update
        db.run(sql, params, function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (this.changes === 0) {
                res.status(404).json({ message: 'No changes made' });
                return;
            }

            // Step 4: Log history changes
            Object.entries(fieldMap).forEach(([inputField, dbField]) => {
                const newValueRaw = req.body[inputField];
                if (newValueRaw !== undefined) {
                    let newValue = newValueRaw;
                    let oldValue = originalTask[dbField];

                    if (dbField === 'completed') {
                        newValue = newValue ? 1 : 0;
                    } else if (dbField === 'recurring') {
                        newValue = (newValue === null || typeof newValue !== 'object') ? '' : JSON.stringify(newValue);
                        try { oldValue = JSON.stringify(JSON.parse(oldValue)); } catch (e) {}
                    }

                    logTaskHistory(id, dbField, oldValue, newValue);
                }
            });

            // Step 5: Return updated task
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                if (!row) {
                    res.status(404).json({ message: 'Task updated but retrieval failed' });
                    return;
                }

                debouncedPublishUpcomingTasksState();
                res.json({ message: 'Task updated successfully', task: processTaskRow(row) });
            });
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
