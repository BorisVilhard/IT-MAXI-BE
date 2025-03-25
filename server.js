// server.js
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { corsOptions } from './config/corsOptions.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import verifyJWT from './middleware/verifyJWT.js';

import { logger } from './middleware/logEvents.js';
import errorHandler from './middleware/errorHandler.js';
import credentials from './middleware/credentials.js';
import connectDB from './config/dbConn.js';

// Import route handlers
import authRoutes from './routes/auth.js';
import usersRoutes from './api/users.js';
import rootRoutes from './routes/root.js';
import registerRoutes from './routes/register.js';
import refreshRoutes from './routes/refresh.js';
import logoutRoutes from './routes/logout.js';
import listRoute from './routes/list.js';
import profileRoutes from './routes/profile.js';

const app = express();
const server = http.createServer(app);

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Connect to MongoDB
connectDB();

// Middleware setup
app.use(logger); // Custom logging middleware
app.use(credentials); // Handle credentials before CORS
app.use(cors(corsOptions)); // CORS middleware with predefined options
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static files (e.g., for uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes (no JWT required)
app.use('/', rootRoutes);
app.use('/auth', authRoutes); // Updated to point to public auth routes
app.use('/register', registerRoutes);
app.use('/refresh', refreshRoutes);
app.use('/logout', logoutRoutes);
app.use('/list', listRoute);
app.use('/profile', profileRoutes); // If public or custom protected inside

// Protected routes (JWT required)
app.use('/users', usersRoutes);

// Root test endpoint
app.get('/', (req, res) => {
	res.send('Google Drive Folder & File Monitor with Socket.io');
});

// Catch-all for 404 errors
app.all('*', (req, res) => {
	res.status(404);
	if (req.accepts('html')) {
		res.sendFile(path.join(__dirname, 'views', '404.html'));
	} else if (req.accepts('json')) {
		res.json({ error: '404 Not Found' });
	} else {
		res.type('txt').send('404 Not Found');
	}
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 3500;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
