const fs = require('fs');
const path = require('path');
const { openDatabase } = require('./db/connection');
const { createSchema } = require('./db/schema');
const { createApp } = require('./app');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = openDatabase(process.env.DB_FILE || path.join(dataDir, 'weekwok.db'));
createSchema(db);

const port = process.env.PORT || 3000;
createApp(db).listen(port, () => console.log(`WeekWok running at http://localhost:${port}`));
