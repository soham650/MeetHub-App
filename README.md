# MeetHub App

MeetHub App is a real-time video conferencing web application that supports group meetings, collaborative whiteboard, instant messaging, and secure file sharing. It is built using React, WebRTC, Socket.io, Node.js, Express, and MongoDB.

## Key Features

- **Video Conferencing**: Real-time group video and audio calls powered by WebRTC.
- **Screen Sharing**: Easily share your desktop screen with other participants in the room.
- **Live Text Chat**: Real-time messaging within the meeting room.
- **Collaborative Whiteboard**: Draw, erase, clear, and download drawings on a shared canvas.
- **Safe File Sharing**: Share files with meeting members with built-in restriction on dangerous file extensions.
- **Security & Protection**: Built-in authentication (JWT), secure HTTP headers (Helmet), and request rate limiting.

## Project Structure

- `client/`: React frontend application built with Vite.
- `server/`: Node.js and Express backend signaling server.

## Getting Started

### Prerequisites

Ensure you have Node.js and MongoDB installed on your system.

### Configuration

#### Server Setup
1. Navigate to the `server` folder.
2. Create a `.env` file and configure the following variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/meethub
   JWT_SECRET=your_jwt_secret_key_here
   CLIENT_URL=http://localhost:5173
   ```

#### Client Setup
1. Navigate to the `client` folder.
2. The client is pre-configured to connect to the backend server running at `http://localhost:5000`.

### Installation and Running

#### 1. Start the Backend Server
```bash
cd server
npm install
npm run dev
```
The server will start on port 5000 and connect to the MongoDB database.

#### 2. Start the Frontend Client
```bash
cd client
npm install
npm run dev
```
The application will be running locally at `http://localhost:5173`. Open it in your web browser to sign up, log in, and join rooms.

## API Documentation

- **POST /api/auth/register**: Create a new account.
- **POST /api/auth/login**: Log in to an existing account.
- **POST /api/rooms/upload**: Upload and share files within a room.
