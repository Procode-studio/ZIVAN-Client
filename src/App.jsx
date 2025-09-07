import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import Root from './pages/Root.jsx';
import './App.css';

const getUserIdFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user.id;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

const PrivateRoute = ({ children, userId }) => {
  const token = localStorage.getItem('token');
  return token ? React.cloneElement(children, { userId }) : <Navigate to="/login" />;
};

function App() {
  const userId = getUserIdFromToken();

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Root />} />

          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute userId={userId}>
                <ChatPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;