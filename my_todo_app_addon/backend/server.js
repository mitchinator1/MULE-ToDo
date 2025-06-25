console.log("SERVER.JS: STARTING EXECUTION");

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const mqtt = require('mqtt');

const { fieldMap, reverseFieldMap } = require('./utils/fieldMap');

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
        name: "MULE To-Do",
        model: "MULE To-Do Add-on",
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
                end_type TEXT DEFAULT 'never',
                end_after_occurrences INTEGER DEFAULT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // Task History
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

const processTaskRow = (row) => {
	const mappedRow = {};

	for (const key in row) {
		const frontendKey = reverseFieldMap[key] || key;
		mappedRow[frontendKey] = row[key];
	}

	// Convert recurring fields into nested structure
	const {
		frequency,
		interval,
		by_day,
		by_month_day,
		recurring_start_date,
		recurring_end_date,
		recurring_end_type,
		recurring_end_after_occurrences
	} = row;

	const hasRecurring =
		frequency || interval || by_day || by_month_day || recurring_start_date || recurring_end_date || recurring_end_type;

	if (hasRecurring) {
		const recurring = {
			frequency: frequency || null,
			interval: interval || null,
			by_day: by_day || null,
			by_month_day: by_month_day || null,
			start_date: recurring_start_date || null,
            end: {
                date: recurring_end_date || null,
				type: recurring_end_type || 'never',
                after_occurrences: recurring_end_after_occurrences || null,
			}
		};

		mappedRow.recurring = recurring;
	} else {
		mappedRow.recurring = null;
	}

	return mappedRow;
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

    db.all(`SELECT id, title, description, created_at, due_date, priority, status, category_id FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date != ""`, [], (err, rows) => {
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
                console.error(`Error parsing due_date for task ${task.id}: ${task.dueDate}, Error: ${dateError.message}`);
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

// GET all tasks
app.get('/api/tasks', (req, res) => {
    const sql = `
      SELECT tasks.*, recurring_rules.frequency, recurring_rules.interval, recurring_rules.by_day,
             recurring_rules.by_month_day, recurring_rules.start_date AS recurring_start_date,
             recurring_rules.end_date AS recurring_end_date, recurring_rules.end_type AS recurring_end_type,
            recurring_rules.end_after_occurrences AS recurring_end_after_occurrences
      FROM tasks
      LEFT JOIN recurring_rules ON tasks.id = recurring_rules.task_id
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Map rows to add recurring objects
        const processedTasks = rows.map(row => {
            const processed = processTaskRow(row)

            // Clean up flattened join columns
            delete row.frequency;
            delete row.interval;
            delete row.by_day;
            delete row.by_month_day;
            delete row.recurring_start_date;
            delete row.recurring_end_date;
            delete row.recurring_end_type;
            delete row.recurring_end_after_occurrences;

            return processed;
        });

        res.json(processedTasks);
    });
});

// GET a single task by ID
app.get('/api/tasks/:id', (req, res) => {
	const { id } = req.params;

	const sql = `
        SELECT tasks.*, recurring_rules.frequency, recurring_rules.interval, recurring_rules.by_day,
                recurring_rules.by_month_day, recurring_rules.start_date AS recurring_start_date,
                recurring_rules.end_date AS recurring_end_date, recurring_rules.end_type AS recurring_end_type,
                recurring_rules.end_after_occurrences AS recurring_end_after_occurrences
        FROM tasks
        LEFT JOIN recurring_rules ON tasks.id = recurring_rules.task_id
        WHERE tasks.id = ?
    `;

	db.get(sql, [id], (err, row) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		if (!row) {
			res.status(404).json({ message: 'Task not found' });
			return;
        }

        const processed = processTaskRow(row);

        // Clean up flattened join columns
        delete row.frequency;
        delete row.interval;
        delete row.by_day;
        delete row.by_month_day;
        delete row.recurring_start_date;
        delete row.recurring_end_date;
        delete row.recurring_end_type;
        delete row.recurring_end_after_occurrences;

		res.json(processed);
	});
});

// GET history of a single task by ID
app.get('/api/tasks/:id/history', (req, res) => {
    const { id } = req.params;

    db.all(`
        SELECT id, field_changed, old_value, new_value, changed_at
        FROM task_history
        WHERE task_id = ?
        ORDER BY changed_at DESC
    `, [id], (err, rows) => {
        if (err) {
            console.error(`Error fetching history for task ${id}:`, err.message);
            return res.status(500).json({ error: 'Failed to retrieve task history' });
        }

        const mappedHistory = rows.map(entry => ({
            ...entry,
            field_changed: reverseFieldMap[entry.field_changed] || entry.field_changed
        }));
        res.json(mappedHistory);
    });
});

// GET all categories
app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST a new task
app.post('/api/tasks', (req, res) => {
    const dbFields = [];
    const placeholders = [];
    const values = [];

    Object.entries(fieldMap).forEach(([inputField, dbField]) => {
        let value = req.body[inputField];

        if (value !== undefined) {
            if (dbField === 'completed') {
                value = value ? 1 : 0;
            }  else if ((dbField === 'parent_task_id' || dbField === 'category_id') && value === '') {
                value = null;
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

    db.run(`
        INSERT INTO tasks (${dbFields.join(', ')}) VALUES (${placeholders.join(', ')})
        `, values, function (err) {
        if (err) {
            console.error('Error inserting task:', err.message);
            return res.status(500).json({ error: err.message });
        }

        const taskId = this.lastID;
        const recurring = req.body.recurring;

        if (recurring) {
            let parsed;
            if (typeof recurring === 'string') {
                try {
                parsed = JSON.parse(recurring);
                } catch(e) {
                console.error('Invalid recurring JSON:', e);
                }
            } else if (typeof recurring === 'object') {
                parsed = recurring;
            }

            if (parsed) {
                const frequency = parsed.frequency || '';
                const interval = parsed.interval || 1;
                const by_day = parsed.by_day || null;
                const by_month_day = parsed.by_month_day || null;
                const start_date = parsed.start_date;
                let end_date = null;
                const end_type = parsed.end ? parsed.end.type : 'never'; // 'on', 'after', or 'never'
                const end_after_occurrences = parsed.end?.type === 'after' ? parsed.end.after_occurrences : null;

                if (parsed.end) {
                    if (parsed.end.type === 'on') {
                    end_date = parsed.end.date;  // date string expected here
                    } else {
                    end_date = null; // 'never' or 'after' — no date stored for now
                    }
                }

                if (!frequency) {
                    console.warn('Invalid recurring pattern: missing frequency');
                } else {
                    const insertRecurring = `
                    INSERT INTO recurring_rules (task_id, frequency, interval, by_day, by_month_day, start_date, end_date, end_type, end_after_occurrences)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    db.run(insertRecurring, [taskId, frequency, interval, by_day, by_month_day, start_date, end_date, end_type, end_after_occurrences], (recErr) => {
                    if (recErr) {
                        console.error('Error inserting recurring rule:', recErr.message);
                    }
                    });
                }
            }
        }

        // Fetch and return the newly created task
        db.get(`
            SELECT tasks.*, recurring_rules.frequency, recurring_rules.interval, recurring_rules.by_day,
                recurring_rules.by_month_day, recurring_rules.start_date AS recurring_start_date,
                recurring_rules.end_date AS recurring_end_date, recurring_rules.end_type AS recurring_end_type,
                recurring_rules.end_after_occurrences AS recurring_end_after_occurrences
            FROM tasks
            LEFT JOIN recurring_rules ON tasks.id = recurring_rules.task_id
            WHERE tasks.id = ?
            `, [taskId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            const processed = processTaskRow(row);
            debouncedPublishUpcomingTasksState();
            res.status(201).json(processed);
        });
    });
});

// POST an undo task
app.post('/api/tasks/:id/undo', (req, res) => {
    const { id } = req.params;

    // Step 1: Get the most recent history entry
    db.get(`
        SELECT * FROM task_history
        WHERE task_id = ?
        ORDER BY changed_at DESC
        LIMIT 1
    `, [id], (err, historyEntry) => {
        if (err) {
            console.error('Error querying task history:', err.message);
            return res.status(500).json({ error: 'Failed to query task history' });
        }

        if (!historyEntry) {
            return res.status(404).json({ message: 'No history to undo' });
        }

        const field = historyEntry.field_changed;
        const oldValue = historyEntry.old_value;

        // Step 2: Revert the field on the task
        const updateSQL = `UPDATE tasks SET ${field} = ? WHERE id = ?`;

        db.run(updateSQL, [oldValue, id], function (updateErr) {
            if (updateErr) {
                console.error('Error reverting task field:', updateErr.message);
                return res.status(500).json({ error: 'Failed to revert task change' });
            }

            // Step 3: Log the undo as a new history entry
            db.run(`
                INSERT INTO task_history (task_id, field_changed, old_value, new_value)
                VALUES (?, ?, ?, ?)
            `, [id, field, historyEntry.new_value, oldValue], function (logErr) {
                if (logErr) {
                    console.error('Error logging undo change:', logErr.message);
                }

                // Step 4: Return the updated task
                db.get('SELECT * FROM tasks WHERE id = ?', [id], (getErr, row) => {
                    if (getErr) {
                        return res.status(500).json({ error: 'Task updated but retrieval failed' });
                    }

                    res.json({
                        message: `Reverted field '${field}'`,
                        task: processTaskRow(row),
                        undoneField: field
                    });
                });
            });
        });
    });
});

// POST a redo task
app.post('/api/tasks/:id/redo', (req, res) => {
    const { id } = req.params;

    // Step 1: Get the most recent revert/undo (where we just swapped values)
    db.get(`
        SELECT * FROM task_history
        WHERE task_id = ?
        ORDER BY changed_at DESC
        LIMIT 1
    `, [id], (err, lastChange) => {
        if (err) {
            console.error('Error retrieving task history:', err.message);
            return res.status(500).json({ error: 'Failed to fetch task history' });
        }

        if (!lastChange) {
            return res.status(404).json({ message: 'No history to redo' });
        }

        const { field_changed, old_value, new_value } = lastChange;

        // We assume redo means: apply the value we had *before* the undo
        const redoSQL = `UPDATE tasks SET ${field_changed} = ? WHERE id = ?`;

        db.run(redoSQL, [new_value, id], function (updateErr) {
            if (updateErr) {
                console.error('Error applying redo:', updateErr.message);
                return res.status(500).json({ error: 'Failed to redo task change' });
            }

            // Log the redo (flipping values again)
            db.run(`
                INSERT INTO task_history (task_id, field_changed, old_value, new_value)
                VALUES (?, ?, ?, ?)
            `, [id, field_changed, old_value, new_value], function (logErr) {
                if (logErr) {
                    console.error('Failed to log redo:', logErr.message);
                }

                db.get('SELECT * FROM tasks WHERE id = ?', [id], (getErr, row) => {
                    if (getErr) {
                        return res.status(500).json({ error: 'Redo applied, but task retrieval failed' });
                    }

                    res.json({
                        message: `Redid change to '${field_changed}'`,
                        task: processTaskRow(row),
                        redoneField: field_changed
                    });
                });
            });
        });
    });
});

// POST create a new category
app.post('/api/categories', (req, res) => {
    const { name, parent_id = null } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    db.run(
        `INSERT INTO categories (name, parent_id) VALUES (?, ?)`,
        [name, parent_id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, name, parent_id });
        }
    );
});

// PUT/PATCH update an existing task
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const updates = [];
    const values = [];

    Object.entries(fieldMap).forEach(([inputField, dbField]) => {
        const value = req.body[inputField];
        if (value !== undefined && dbField !== 'recurring') {
            updates.push(`${dbField} = ?`);
            values.push(value);
        }
    });

    if (updates.length === 0 && !req.body.recurring) {
        return res.status(400).json({ error: 'No valid fields provided' });
    }

    // Step 1: Update task if needed
    const updateTask = () => {
        return new Promise((resolve, reject) => {
            if (updates.length === 0) return resolve(); // skip if no updates

            const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
            values.push(id);
            db.run(sql, values, function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    };

    // Step 2: Update recurring_rules
    const updateRecurring = () => {
        return new Promise((resolve, reject) => {
            const recurring = req.body.recurring;
            if (!recurring) return resolve(); // no recurring to update

            let parsed;
            try {
                parsed = typeof recurring === 'string' ? JSON.parse(recurring) : recurring;
            } catch (e) {
                return reject(new Error('Invalid recurring JSON'));
            }

            const frequency = parsed.frequency || '';
            const interval = parsed.interval || 1;
            const by_day = parsed.by_day || null;
            const by_month_day = parsed.by_month_day || null;
            const start_date = parsed.start_date;
            let end_date = null;
            const end_type = parsed.end?.type || 'never';
            const after_occurrences = parsed.end?.after_occurrences || null;

            if (end_type === 'on') {
                end_date = parsed.end.date || null;
            }

            if (!frequency) {
                console.warn('Missing frequency in recurring update');
                return resolve(); // Don't insert/update invalid rule
            }

            const checkSql = `SELECT 1 FROM recurring_rules WHERE task_id = ?`;
            db.get(checkSql, [id], (err, row) => {
                if (err) return reject(err);

                const query = row
                    ? {
                        sql: `UPDATE recurring_rules
                            SET frequency = ?, interval = ?, by_day = ?, by_month_day = ?, start_date = ?, end_date = ?, end_type = ?, end_after_occurrences = ?
                            WHERE task_id = ?`,
                        values: [frequency, interval, by_day, by_month_day, start_date, end_date, end_type, after_occurrences, id]
                    }
                    : {
                        sql: `INSERT INTO recurring_rules (task_id, frequency, interval, by_day, by_month_day, start_date, end_date, end_type, end_after_occurrences)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        values: [id, frequency, interval, by_day, by_month_day, start_date, end_date, end_type, after_occurrences]
                    };

                db.run(query.sql, query.values, (dbErr) => {
                    if (dbErr) return reject(dbErr);
                    resolve(); // only now resolve
                });
            });
        });
    };

    // Final: run everything
    updateTask()
        .then(updateRecurring)
        .then(() => {
            db.get(`
                SELECT tasks.*, recurring_rules.frequency, recurring_rules.interval, recurring_rules.by_day,
                    recurring_rules.by_month_day, recurring_rules.start_date AS recurring_start_date,
                    recurring_rules.end_date AS recurring_end_date, recurring_rules.end_type AS recurring_end_type,
                    recurring_rules.end_after_occurrences AS recurring_end_after_occurrences
                FROM tasks
                LEFT JOIN recurring_rules ON tasks.id = recurring_rules.task_id
                WHERE tasks.id = ?
            `, [id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!row) return res.status(404).json({ message: 'Task not found' });

                const processed = processTaskRow(row);

                // Clean up flattened join columns
                delete row.frequency;
                delete row.interval;
                delete row.by_day;
                delete row.by_month_day;
                delete row.recurring_start_date;
                delete row.recurring_end_date;
                delete row.recurring_end_type;
                delete row.recurring_end_after_occurrences;

                res.json({ message: 'Task updated successfully', task: processed });
            });
        })
        .catch((err) => {
            console.error('Error updating task:', err.message);
            res.status(500).json({ error: err.message });
        });
});

// PUT update a category
app.put('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name, parent_id = null } = req.body;

    db.run(
        `UPDATE categories SET name = ?, parent_id = ? WHERE id = ?`,
        [name, parent_id, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, name, parent_id });
        }
    );
});

// DELETE a task
app.delete('/api/tasks/:id', (req, res) => {
	const { id } = req.params;

	db.serialize(() => {
		// Explicitly delete recurring rule (optional if using ON DELETE CASCADE)
		db.run('DELETE FROM recurring_rules WHERE task_id = ?', [id], (recErr) => {
			if (recErr) {
				console.warn('Failed to delete recurring rule (possibly not found):', recErr.message);
			}
		});

		// Delete the task itself
		db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
			if (err) {
				return res.status(500).json({ error: err.message });
			}
			if (this.changes === 0) {
				return res.status(404).json({ message: 'Task not found' });
			}

			debouncedPublishUpcomingTasksState();
			res.json({ message: 'Task deleted successfully', changes: this.changes });
		});
	});
});

// DELETE a category
app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;

    // Step 1: Nullify category references in tasks
    db.run(`
        UPDATE tasks SET category_id = NULL WHERE category_id = ?
        `, [id], function (err) {
        if (err) {
            console.error('Error clearing category from tasks:', err.message);
            return res.status(500).json({ error: err.message });
        }

        // Step 2: Delete the category itself
        db.run(`
            DELETE FROM categories WHERE id = ?
            `, [id], function (err2) {
            if (err2) {
                console.error('Error deleting category:', err2.message);
                return res.status(500).json({ error: err2.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'Category not found' });
            }

            res.json({ message: 'Category deleted successfully' });
        });
    });
});

// Global error handlers
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
