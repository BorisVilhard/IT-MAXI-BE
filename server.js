import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { corsOptions } from './config/corsOptions.js';
import { logger } from './middleware/logEvents.js';
import errorHandler from './middleware/errorHandler.js';
import verifyJWT from './middleware/verifyJWT.js';
import credentials from './middleware/credentials.js';

// Import database connection
import connectDB from './config/dbConn.js';

// Import route handlers
import rootRoutes from './routes/root.js';
import registerRoutes from './routes/register.js';
import refreshRoutes from './routes/refresh.js';
import logoutRoutes from './routes/logout.js';
import userRoutes from './api/users.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import listRoute from './routes/list.js';

// Import necessary modules
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';

// Initialize Express app and HTTP server
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
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.urlencoded({ extended: false })); // Additional URL-encoded parser
app.use(express.json()); // Parse JSON bodies

// Serve static files (e.g., for uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes (no JWT required)
app.use('/', rootRoutes);
app.use('/auth', authRoutes);
app.use('/register', registerRoutes);
app.use('/refresh', refreshRoutes);
app.use('/logout', logoutRoutes);
app.use('/list', listRoute);
// Protected routes (require JWT verification)
app.use('/users', verifyJWT, userRoutes); // JWT applied only to /users

// Profile routes (mix of public and protected, handled in profile.js)
app.use('/profile', profileRoutes); // No global JWT here

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
