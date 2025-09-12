// Global variables
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = { id: data.userId, username: data.username };
            showChatbot();
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showAuth();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Authentication forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Chat functionality
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('refresh-history').addEventListener('click', loadChatHistory);
    
    // Auto-resize chat input
    document.getElementById('chat-input').addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = { id: data.userId, username: data.username };
            showToast('Login successful!', 'success');
            showChatbot();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!username || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = { id: data.userId, username: data.username };
            showToast('Registration successful!', 'success');
            showChatbot();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showAuth();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// Chat functions
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';
    
    // Disable send button
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addMessageToChat(data.response, 'bot');
        } else {
            addMessageToChat(data.error || 'Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        console.error('Chat error:', error);
        addMessageToChat('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
    } finally {
        sendBtn.disabled = false;
    }
}

function addMessageToChat(message, sender) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `${sender}-message`;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(message)}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-robot"></i>
                <p>${escapeHtml(message)}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}








// Chat history functions
async function loadChatHistory() {
    const historyContainer = document.getElementById('history-messages');
    historyContainer.innerHTML = '<div class="loading">Loading chat history...</div>';
    
    try {
        const response = await fetch('/api/chat-history');
        const data = await response.json();
        
        if (data.success && data.chats.length > 0) {
            historyContainer.innerHTML = '';
            
            data.chats.forEach(chat => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const timestamp = new Date(chat.timestamp).toLocaleString();
                
                historyItem.innerHTML = `
                    <div class="user-query">You: ${escapeHtml(chat.user_message)}</div>
                    <div class="bot-response">Bot: ${escapeHtml(chat.bot_response)}</div>
                    <div class="timestamp">${timestamp}</div>
                `;
                
                historyContainer.appendChild(historyItem);
            });
        } else {
            historyContainer.innerHTML = '<div class="loading">No chat history found. Start a conversation to see your history here!</div>';
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        historyContainer.innerHTML = '<div class="loading">Error loading chat history. Please try again.</div>';
    }
}

// UI functions
function showAuth() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('chatbot-section').style.display = 'none';
    
    // Clear forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

function showChatbot() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('chatbot-section').style.display = 'flex';
    
    // Update username display
    document.getElementById('username-display').textContent = `Welcome, ${currentUser.username}!`;
    
    // Load chat history if on history tab
    if (document.getElementById('history-tab').classList.contains('active')) {
        loadChatHistory();
    }
    
    // Focus on chat input
    document.getElementById('chat-input').focus();
}

function showLogin() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
}

function showRegister() {
    document.getElementById('register-form').classList.add('active');
    document.getElementById('login-form').classList.remove('active');
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Load chat history if history tab is selected
    if (tabName === 'history') {
        loadChatHistory();
    }
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('message-toast');
    const messageSpan = document.getElementById('toast-message');
    
    messageSpan.textContent = message;
    toast.className = `message-toast ${type}`;
    toast.style.display = 'flex';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    document.getElementById('message-toast').style.display = 'none';
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize welcome message timestamp
window.addEventListener('load', function() {
    const welcomeMessage = document.querySelector('.bot-message .message-time');
    if (welcomeMessage) {
        const now = new Date();
        welcomeMessage.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
});