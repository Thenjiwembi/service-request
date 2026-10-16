require('dotenv').config();

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`FlowDesk is listening on port ${port}`);
  console.log('Using an in-memory store; requests reset when the server restarts.');
});
