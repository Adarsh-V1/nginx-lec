import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;


const assetsDir = fs.existsSync(path.join(__dirname, 'assets'))
  ? path.join(__dirname, 'assets')
  : path.join(__dirname, '..', 'assets');

app.use('/assets', express.static(assetsDir));
app.use('/images', express.static(assetsDir));

const appName = process.env.APP_NAME || 'node app';

app.use('/', (req, res) => {
  res.setHeader('X-Served-By', appName);
  res.sendFile(path.join(__dirname, 'index.html'));
  console.log(`Request served by node app: ${appName}`);
});

app.listen(port, () => {
  console.log(`node app is listening on port ${port}`);
});