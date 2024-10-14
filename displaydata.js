const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');


const app = express();
const port = 3000;


// Connection URI for MongoDB
const uri = 'mongodb+srv://Shreynik:Dinku2005@cluster0.xh7s8.mongodb.net/';
const client = new MongoClient(uri);
let collection, usersCollection, offersCollection, messagesCollection;

// Middleware to parse JSON requests
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(cors({
    origin: 'https://shreynik00.github.io',  // Allow your GitHub Pages site
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allow specific HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers
    credentials: true  // Allow credentials if needed
    
}));

// Handle preflight requests
app.options('*', cors());


// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Connect to MongoDB once at the start
async function connectDB() {
    try {
        await client.connect();
        const database = client.db('Freelancer');
        collection = database.collection('one'); // Tasks
        usersCollection = database.collection('users'); // Users
        offersCollection = database.collection('Offer'); // Offers
        messagesCollection = database.collection('messages'); // Messages
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
}

connectDB();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file for user setup
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Usersetup.html'));
});

app.get('/current-username', (req, res) => {
    const user = req.session.user;
    
    if (!user || !user.username) {
        return res.status(401).json({ message: 'User not logged in.' });
    }
    
    res.status(200).json({ username: user.username });
});

// API to fetch current logged-in username from session
app.get('/current-username', (req, res) => {
    if (req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});

// Fetch task details by ID
app.get('/tasks/:id', async (req, res) => {
    const taskId = req.params.id; 
    try {
        // Assuming `collection` is your MongoDB collection
        const task = await collection.findOne({ _id: new ObjectId(taskId) }); // Use ObjectId for MongoDB

        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// API to fetch offers for a specific task
app.get('/offers/:taskId', async (req, res) => {
    const { taskId } = req.params;
    try {
        const offers = await offersCollection.find({ taskId: new ObjectId(taskId) }).toArray();
        res.json(offers);
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to register a new user
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ username, email, password: hashedPassword });

        res.json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to log in a user
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await usersCollection.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.json({ message: 'Invalid username or password.' });
        }

        req.session.user = { username: user.username, email: user.email, _id: user._id };
        res.json({ message: 'Login successful', username: user.username, email: user.email });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to fetch user details
// API to fetch user details by username
// API to fetch user details by username
app.get('/user/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await usersCollection.findOne({ username: username });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ username: user.username, email: user.email });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// API to fetch tasks
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await collection.find().toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to send a message
app.post('/sendMessage', async (req, res) => {
    const { title, message, taskOwnerId } = req.body; // Extract title, message, and task owner's ID from the request body
    const user = req.session.user; // Get the currently logged-in user from the session

    if (!user || !user._id) { // Check if user is logged in
        return res.status(401).json({ message: 'User not logged in.' });
    }

    try {
        // Fetch sender's username using their _id
        const sender = await usersCollection.findOne({ _id: new ObjectId(user._id) });
        if (!sender || !sender.username) {
            return res.status(404).json({ message: 'Sender not found.' });
        }

        // Fetch task owner's username using taskOwnerId
        const taskOwner = await usersCollection.findOne({ _id: new ObjectId(taskOwnerId) });
        if (!taskOwner || !taskOwner.username) {
            return res.status(404).json({ message: 'Task owner not found.' });
        }

        // Insert the message into the 'messages' collection with usernames instead of IDs
        await messagesCollection.insertOne({
            senderUsername: sender.username, // Store sender's username
            recipientUsername: taskOwner.username, // Store task owner's username
            title, // Message title
            message // Message content
        });

        res.json({ message: 'Message sent successfully.' }); // Return success response
    } catch (error) {
        console.error('Error sending message:', error); // Log any errors
        res.status(500).json({ message: 'Internal server error.' }); // Return error response
    }
});

//get message
app.get('/messages', async (req, res) => {
    const userId = req.query.userId; // Get userId from the URL query parameters

    if (!userId) { // Check if userId is provided
        return res.status(400).json({ message: 'UserId not provided.' });
    }

    try {
        // Find messages where the recipientId matches the userId from the URL
        const messages = await messagesCollection.find({
            recipientId: new ObjectId(userId) // Convert userId to ObjectId
        }).toArray(); // Convert cursor to array

        // Format messages with only title and message
        const formattedMessages = messages.map(msg => ({
            title: msg.title,
            message: msg.message
        }));

        res.json(formattedMessages); // Return the formatted messages
    } catch (error) {
        console.error('Error fetching messages:', error); // Log any errors
        res.status(500).json({ message: 'Internal server error.' }); // Return error response
    }
});





// API to fetch tasks for service receiver (only tasks posted by the logged-in user)
// API to fetch all tasks for the current logged-in user
app.get('/task', async (req, res) => {
    // Check if the user is logged in and username is available in the session
    if (!req.session.user || !req.session.user.username) {
        return res.status(401).json({ message: 'User not logged in.' });
    }

    const username = req.session.user.username;  // Fetch username from the session

    try {
        // Query for all tasks associated with the current logged-in user's username
        const tasks = await collection.find({ username: username }).toArray();

        // Check if tasks exist for the current user
        if (tasks.length === 0) {
            return res.status(404).json({ message: 'No tasks found for this user.' });
        }

        // Return the tasks in the response
        res.json(tasks);
    } catch (error) {
        // Log error if something goes wrong with fetching the tasks
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



//return cuurent userID
app.get('/receiverIndex/tasks', (req, res) => {
    const user = req.session.user; // Get user from session
    if (!user || !user.username) {
        return res.status(401).json({ message: 'User not logged in.' });
    }

    // Return only userId and sessionId
    res.json({
        userId: user._id,  // Assuming user._id stores the user's unique ID
        sessionId: req.sessionID  // session ID from express-session
    });
});

// Role selection page
app.get('/role-selection', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'role-selection.html')); // Ensure this file exists in your public directory
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});

// API to submit an offer
app.post('/submit-offer', async (req, res) => {
    const { taskId, deadline, message,pitch, username } = req.body; // Extract username from the request body
  

   
    try {
        await offersCollection.insertOne({
            taskId: new ObjectId(taskId), 
            username, // Store the username directly
            message,
            deadline,
            pitch
        });
        res.status(201).json({ message: 'Offer submitted successfully.' });
    } catch (error) {
        console.error('Error submitting offer:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// API to add a new task with user's specific ID
app.post('/add-task', async (req, res) => {
    const { title, detail, deadline, mode, type, budget, username } = req.body;  // Extract username from the request body

    try {
        // Insert task with the provided username and other details
        const result = await collection.insertOne({
            title,
            detail,
            deadline,  // Store the deadline of the task
            mode,
            type,
            budget,    // Store the budget value
            username   // Store the username from the request body
        });

        // Send a successful response with the task ID
        res.status(200).json({ success: true, message: 'Task added successfully', taskId: result.insertedId });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ success: false, message: 'Failed to add task' });
    }
});



// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
