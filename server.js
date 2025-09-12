const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const groqService = require('./groqService');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'health-chatbot-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// SQLite Database is initialized in database.js

// Authentication middleware
const authenticateUser = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Please log in to access this feature' });
  }
};

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          req.session.userId = this.lastID;
          req.session.username = username;
          
          res.json({ 
            success: true, 
            message: 'User registered successfully',
            userId: this.lastID,
            username: username
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      
      res.json({ 
        success: true, 
        message: 'Login successful',
        userId: user.id,
        username: user.username
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      authenticated: true, 
      userId: req.session.userId,
      username: req.session.username
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Chat endpoint with Groq API integration
app.post('/api/chat', authenticateUser, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.session.userId;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get user's chat history for personalized responses
    db.all(
      'SELECT user_message, bot_response FROM chats WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10',
      [userId],
      async (err, chatHistory) => {
        if (err) {
          console.error('Error fetching chat history:', err);
          chatHistory = [];
        }
        
        // Generate AI response using Groq
        const groqResponse = await groqService.generateHealthResponse(message.trim(), chatHistory);
        
        if (groqResponse.success) {
          // Save the conversation to database
          db.run(
            'INSERT INTO chats (user_id, user_message, bot_response) VALUES (?, ?, ?)',
            [userId, message.trim(), groqResponse.response],
            (err) => {
              if (err) {
                console.error('Error saving chat:', err);
              }
            }
          );
          
          res.json({ 
            success: true, 
            response: groqResponse.response 
          });
        } else {
          // Still save non-health queries for tracking
          db.run(
            'INSERT INTO chats (user_id, user_message, bot_response) VALUES (?, ?, ?)',
            [userId, message.trim(), groqResponse.response],
            (err) => {
              if (err) {
                console.error('Error saving chat:', err);
              }
            }
          );
          
          res.json({ 
            success: true, 
            response: groqResponse.response 
          });
        }
      }
    );
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ 
      error: 'I\'m having trouble processing your request. Please try again.' 
    });
  }
});

// Get chat history
app.get('/api/chat-history', authenticateUser, (req, res) => {
  const userId = req.session.userId;
  
  db.all(
    'SELECT user_message, bot_response, timestamp FROM chats WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch chat history' });
      }
      
      res.json({ success: true, chats: results });
    }
  );
});

// Get personalized health suggestions
app.get('/api/health-suggestions', authenticateUser, (req, res) => {
  const userId = req.session.userId;
  
  db.all(
    'SELECT user_message, bot_response FROM chats WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch chat history for suggestions' });
      }
      
      try {
        const suggestions = groqService.generatePersonalizedSuggestions(results);
        const healthPatterns = groqService.analyzeHealthPatterns(results);
        
        res.json({ 
          success: true, 
          suggestions: suggestions,
          patterns: healthPatterns
        });
      } catch (error) {
        console.error('Error generating suggestions:', error);
        res.status(500).json({ error: 'Failed to generate personalized suggestions' });
      }
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;