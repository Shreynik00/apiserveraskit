const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;

// MongoDB Connection URI
const uri = 'mongodb+srv://Shreynik:Dinku2005@cluster0.xh7s8.mongodb.net/';
const client = new MongoClient(uri);
let collection, usersCollection, offersCollection, messagesCollection;

// Initialize HTTP Server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://shreynik00.github.io',
    methods: ['GET', 'POST'],
  },
});

// Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: 'https://shreynik00.github.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Session Configuration
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);

// Connect to MongoDB
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

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.IO Chat Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle Room Joining
  socket.on('joinRoom', ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join('-');
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle New Chat Messages
  socket.on('chatMessage', async (messageData) => {
    const { sender, receiver, message } = messageData;

    if (!sender || !receiver || !message) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    try {
      const timestamp = new Date();
      const newMessage = { sender, receiver, message, timestamp };

      // Save message to MongoDB
      await messagesCollection.insertOne(newMessage);

      // Emit message to room
      const roomId = [sender, receiver].sort().join('-');
      io.to(roomId).emit('newMessage', newMessage);
      console.log(`Message from ${sender} to ${receiver}: "${message}"`);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Failed to save message');
    }
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Fetch Chat History API
app.get('/chat/:sender/:receiver', async (req, res) => {
  const { sender, receiver } = req.params;

  try {
    const messages = await messagesCollection
      .find({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
        ],
      })
      .sort({ timestamp: 1 })
      .toArray();

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Failed to fetch chat history.' });
  }
});

// Fetch Task Provider API
app.post('/chatProvider', async (req, res) => {
  const { title, currentUser } = req.body;

  if (!title || !currentUser) {
    return res.status(400).json({ message: 'Task title and current user are required.' });
  }

  try {
    const task = await collection.findOne({ title, username: currentUser });
    if (!task || !task.TaskProvider) {
      return res.status(404).json({ message: 'Task or Task Provider not found.' });
    }
    res.status(200).json({ TaskProvider: task.TaskProvider });
  } catch (error) {
    console.error('Error fetching TaskProvider:', error);
    res.status(500).json({ message: 'Failed to fetch Task Provider.' });
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

// Profile setup API to update or insert profile data
app.post('/api/user/profile', async (req, res) => {
  const { username, about, skills } = req.body;

  if (!username || !about || !skills) {
    return res.status(400).json({ message: 'Invalid input data' });
  }

  try {
    // Check if a profile already exists
    const existingProfile = await profileInfosCollection.findOne({ username });

    if (existingProfile) {
      // Update existing profile
      const result = await profileInfosCollection.updateOne(
        { username },
        {
          $set: { about, skills },
        }
      );

      if (result.matchedCount > 0) {
        return res.status(200).json({ message: 'Profile updated successfully' });
      } else {
        return res.status(500).json({ message: 'Failed to update profile data' });
      }
    } else {
      // Create a new profile
      const newProfile = { username, about, skills };
      await profileInfosCollection.insertOne(newProfile);

      return res.status(201).json({ message: 'Profile created successfully' });
    }
  } catch (error) {
    console.error('Error handling profile data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/messages', async (req, res) => {
    const { currentUser, receiver } = req.query;

    if (!currentUser || !receiver) {
        return res.status(400).json({ error: "currentUser and receiver are required" });
    }

    try {
        const messages = await MessageCollection.find({
            $or: [
                { sender: currentUser, receiver },
                { sender: receiver, receiver: currentUser }
            ]
        }).sort({ timestamp: 1 }).exec();

        res.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Internal server error" });
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
app.delete('/deleteTask', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required.' });
    }

    try {
        // Delete the task from the "one" collection
        const deleteResult = await collection.deleteOne({ _id: new ObjectId(taskId) });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        res.status(200).json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task.' });
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

    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    try {
        // Find tasks where 'TaskProvider' matches the provided 'username'
        const tasks = await collection.find({ TaskProvider: username }).toArray();

        if (!tasks.length) {
            return res.status(404).json({ message: 'No tasks found for the given TaskProvider.' });
        }

        // This part ensures the existing functionality is not broken.
        // We return the task details and add the username of the person accepting the task.
        const tasksWithUsernames = tasks.map(task => {
            return {
                ...task,
                username: task.username, // Include the username of the task owner (the person who accepted the task)
                taskDetails: {
                    title: task.title,
                    detail: task.detail,
                    deadline: task.deadline,
                    budget: task.budget,
                    status: task.status,
                    mode: task.mode,
                    urgencyType: task.urgencyType,
                    paymentMethod: task.paymentMethod,
                    requirements: task.requirements,
                    type: task.type
                }
            };
        });

        res.status(200).json(tasksWithUsernames);
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
    const { title, detail, deadline, mode, type,urgencyType,paymentMethod,requirements, budget, status,username } = req.body;  // Extract username from the request body

    try {
        // Insert task with the provided username and other details
        const result = await collection.insertOne({
            title,
            detail,
            deadline,  // Store the deadline of the task
            mode,
            urgencyType,
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
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
