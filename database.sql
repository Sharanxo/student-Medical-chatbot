-- AI Student Health Chatbot Database Schema
-- Run these commands in your MySQL database

-- Create database
CREATE DATABASE IF NOT EXISTS health_chatbot;
USE health_chatbot;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_user_id ON chats(user_id);
CREATE INDEX idx_timestamp ON chats(timestamp);
CREATE INDEX idx_username ON users(username);

-- Insert sample data (optional)
-- INSERT INTO users (username, password) VALUES 
-- ('testuser', '$2a$10$example_hashed_password_here');

SELECT 'Database schema created successfully!' as message;