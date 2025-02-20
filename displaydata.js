const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');

const app = express();
const port = 3000;

// Connection URI for MongoDB
const clientt = new OAuth2Client("190022392096-gd9ehpmcvfonm496ip6p5ane43q4g4ce.apps.googleusercontent.com");

const uri = 'mongodb+srv://Shreynik:Dinku2005@cluster0.xh7s8.mongodb.net/';
const client = new MongoClient(uri);
let collection, usersCollection, offersCollection, messagesCollection, profileInfosCollection;

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: 'https://askitindia.github.io',  // Allow your GitHub Pages site
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allow specific HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers
    credentials: true  // Allow credentials if needed
}));


// Handle preflight requests
app.options('*', cors());
app.use(session({
    secret: 'your-secret-key', // Replace with a secure secret
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true } // Ensure secure cookies if using HTTPS
}));

// Connect to MongoDB once at the start
async function connectDB() {
    try {
        await client.connect();
        const database = client.db('Freelancer');
        collection = database.collection('one'); // Tasks
        usersCollection = database.collection('users'); // Users
        offersCollection = database.collection('Offer'); // Offers
        profileInfosCollection = database.collection('profileInfos'); // all profiles
        messagesCollection = database.collection('messages'); // Messages
          questionsCollection = database.collection('question'); // FAQ
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);  // Exit the process if DB connection fails
    }
}

connectDB();

//google sign up 
app.post('/google-login', async (req, res) => {
    const { token } = req.body;

    try {
        const ticket = await clientt.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID || "190022392096-gd9ehpmcvfonm496ip6p5ane43q4g4ce.apps.googleusercontent.com",
});


        const payload = ticket.getPayload();
        const user = {
            googleId: payload.sub,
            username: payload.name,
            email: payload.email,
          
        };

        // Check if user exists in DB
        let existingUser = await usersCollection.findOne({ googleId: user.googleId });

        if (!existingUser) {
            // If user does not exist, insert them into MongoDB
            const result = await usersCollection.insertOne(user);
            existingUser = user;
        }

        res.json({ success: true, user: existingUser });
    } catch (error) {
        console.error("Google login error:", error);
        res.status(401).json({ success: false, error: "Invalid token" });
    }
});

// Google Login Route
app.post('/auth/google', async (req, res) => {
    try {
        const { googleId, email, username } = req.body;
        
        if (!googleId || !email) {
            return res.status(400).json({ success: false, message: "Invalid Google credentials" });
        }

        console.log("Received Google Sign-In Data:", req.body); // Debugging line

        // Check if user exists in MongoDB
        const user = await usersCollection.findOne({ googleId });

        if (!user) {
            // Create a new user if not found
            const newUser = { googleId, email, username };
            await usersCollection.insertOne(newUser);
            return res.json({ success: true, message: "New Google User Registered", user: newUser });
        }

        // User exists, login successful
        res.json({ success: true, message: "Google Login Successful", user });

    } catch (error) {
        console.error("Error during Google authentication:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file for user setup
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// API to fetch current logged-in username from session
app.get('/current-username', (req, res) => {
    if (req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});

// to complete task from  task requester side 
// API to mark a task as completed by setting RequesterEndedTask to true
app.post('/completeTask', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required.' });
    }

    try {
        // Find the task by the provided taskId and update the RequesterEndedTask field
        const updateResult = await collection.updateOne(
            { _id: new ObjectId(taskId) }, // Match by taskId
            { $set: { RequesterEndedTask:" true" } } // Update only RequesterEndedTask field
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        if (updateResult.modifiedCount === 1) {
            res.json({ message: 'Task marked as completed successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to update the task.' });
        }
    } catch (error) {
        console.error('Error marking task as completed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// to complete task from  task provider side 

app.post('/completeTaskProvider', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required.' });
    }

    try {
        // Find the task by the provided taskId and update the RequesterEndedTask field
        const updateResult = await collection.updateOne(
            { _id: new ObjectId(taskId) }, // Match by taskId
            { $set: { ProviderEndedTask:" true" } } // Update only RequesterEndedTask field
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        if (updateResult.modifiedCount === 1) {
            res.json({ message: 'Task marked as completed successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to update the task.' });
        }
    } catch (error) {
        console.error('Error marking task as completed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/task-username/:taskId', async (req, res) => {
    const { taskId } = req.params;

    if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required.' });
    }

    try {
        const task = await collection.findOne({ _id: new ObjectId(taskId) });

        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        res.json({ username: task.username }); // Assuming the task document contains a 'username' field
    } catch (error) {
        console.error('Error fetching task username:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// Profile setup API to update or insert profile data
app.post('/api/user/profile', async (req, res) => {
    const { username, about, skills } = req.body;

    // Validate required fields
    if (!username || !about || !skills) {
        return res.status(400).json({ message: 'Invalid input data' });
    }

    try {
        // Check if a document with the provided username exists in 'profileInfos' collection
        const existingProfile = await profileInfosCollection.findOne({ username });

        if (existingProfile) {
            // Update the existing profile
            const result = await profileInfosCollection.updateOne(
                { username },
                {
                    $set: {
                        about,
                        skills,
                    },
                }
            );

            if (result.matchedCount > 0) {
                return res.status(200).json({ message: 'Profile updated successfully' });
            } else {
                return res.status(500).json({ message: 'Failed to update profile data' });
            }
        } else {
            // Insert a new profile document
            const newProfile = {
                username,
                about,
                skills,
            };

            await profileInfosCollection.insertOne(newProfile);

            return res.status(201).json({ message: 'Profile created successfully' });
        }
    } catch (error) {
        console.error('Error handling profile data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to fetch messages
// Route to fetch messages
app.get('/chat/:taskId', async (req, res) => {
    const { taskId } = req.params;

    try {
        const messages = await messagesCollection.find({ taskId }).toArray();

        if (!messages) {
            return res.status(200).json([]); // Return empty array if no messages found
        }

        res.status(200).json(messages); // Send messages as JSON
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// Route to send messages (POST)
app.post('/chat/send', async (req, res) => {
    const { sender, receiver, message, taskId, timestamp } = req.body;

    if (!sender || !receiver || !message || !taskId || !timestamp) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const newMessage = {
            sender,
            receiver,
            message,
            taskId,
            timestamp
        };

        await messagesCollection.insertOne(newMessage);  // Insert the new message into the database

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// Route to fetch messages
app.get('/question/:taskId', async (req, res) => {
    const { taskId } = req.params;

    try {
        const messages = await questionsCollection.find({ taskId }).toArray();

        if (!messages) {
            return res.status(200).json([]); // Return empty array if no messages found
        }

        res.status(200).json(messages); // Send messages as JSON
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// Route to send messages (POST)
app.post('/question/send', async (req, res) => {
    const { sender, receiver, message, taskId, timestamp } = req.body;

    if (!sender || !receiver || !message || !taskId || !timestamp) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const newMessage = {
            sender,
            receiver,
            message,
            taskId,
            timestamp
        };

        await questionsCollection.insertOne(newMessage);  // Insert the new message into the database

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});


// Route to fetch messages
app.get('/chat/:taskId', async (req, res) => {
    const { taskId } = req.params;

    try {
        const messages = await messagesCollection.find({ taskId }).toArray();

        if (!messages) {
            return res.status(200).json([]); // Return empty array if no messages found
        }

        res.status(200).json(messages); // Send messages as JSON
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});
// Route to send messages (POST)
app.post('/chat/send', async (req, res) => {
    const { sender, receiver, message, taskId, timestamp } = req.body;

    if (!sender || !receiver || !message || !taskId || !timestamp) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const newMessage = {
            sender,
            receiver,
            message,
            taskId,
            timestamp
        };

        await messagesCollection.insertOne(newMessage);  // Insert the new message into the database

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});




// API to fetch current logged-in username from session
app.get('/current-username', (req, res) => {
    if (req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});


// Delete Task API

app.post('/deleteTask', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required.' });
    }

    try {
        const updateResult = await collection.updateOne(
             { _id: new ObjectId(taskId) }, // Match by taskId
            { $set: { isdeleted:" true" } } // Update only RequesterEndedTask field
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        if (updateResult.modifiedCount === 1) {
            res.json({ message: 'Task marked as completed successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to update the task.' });
        }
    } catch (error) {
        console.error('Error marking task as completed:', error);
        res.status(500).json({ message: 'Internal server error.' });
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
// api to accept offer from reciver end 
app.post('/acceptOffer', async (req, res) => {
    const { taskId, offerId, username } = req.body;

    if (!taskId || !offerId || !username) {
        return res.status(400).json({ message: 'taskId, offerId, and username are required.' });
    }

    try {
        // Update the "one" collection for the task
        const taskUpdateResult = await collection.updateOne(
            { _id: new ObjectId(taskId) },
            { 
                $set: { 
                    status: 'accepted',
                    TaskProvider: username // Add TaskProvider field with username
                } 
            }
        );

        // Update the "Offer" collection for the offer
        const offerUpdateResult = await offersCollection.updateOne(
            { _id: new ObjectId(offerId) },
            { $set: { status: 'accepted' } }
        );

        // Check if updates were successful
        if (taskUpdateResult.matchedCount === 0 || offerUpdateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Task or Offer not found.' });
        }

        res.status(200).json({ message: 'Offer accepted successfully.' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Failed to accept offer.' });
    }
});

app.post('/acceptedOffers', async (req, res) => {
    const { username } = req.body;

    // Check if the username is provided in the request body
    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    try {
        // Fetch tasks where TaskProvider matches the provided username
        const tasks = await collection.find({ TaskProvider: username }).toArray();

        // If no tasks are found, return a 404 error
        if (tasks.length === 0) {
            return res.status(404).json({ message: 'No tasks found for the given username.' });
        }

        // If tasks are found, return them as a JSON response
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching accepted offers:', error);
        res.status(500).json({ message: 'Failed to fetch accepted offers.' });
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
        const user = await profileInfosCollection.findOne({ username: username });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ username: user.username, about: user.about, skills : user.skills });
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







// API to fetch tasks for service receiver (only tasks posted by the logged-in user)


// API to fetch all tasks for the current logged-in user
app.get('/reciverIndex/tasks', async (req, res) => {
    const username = req.query.username; // Get the username from query params

    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    try {
        const tasks = await collection.find({ username }).toArray(); // Fetch tasks for the specific username
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching receiver tasks:', error);
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
    const { taskId,  expectedfee,pitch, username } = req.body; // Extract username from the request body
  

   
    try {
        await offersCollection.insertOne({
            taskId: new ObjectId(taskId), 
            username, // Store the username directly
            expectedfee,
            
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
    const { title, detail, deadline, mode, type,isdeleted,ProviderEndedTask,RequesterEndedTask,location,paymentMethod,requirements, budget, status,username } = req.body;  // Extract username from the request body

    try {
        // Insert task with the provided username and other details
        const result = await collection.insertOne({
            title,
            detail,
            deadline,  // Store the deadline of the task
            mode,
            isdeleted,
            RequesterEndedTask,
            ProviderEndedTask,
            location,
            paymentMethod,
            requirements,
            type,
            budget, 
            status,// Store the budget value
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
