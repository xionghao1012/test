const express = require('express');
const app = express();
const path = require('path');

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Welcome to the enterprise website!' });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});