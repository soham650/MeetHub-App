import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '../config';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name || !email || !password) return setError('Please fill in all fields');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        name,
        email,
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/room');

    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#1e293b',
        padding: '40px',
        borderRadius: '14px',
        width: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ color: 'white', margin: '0 0 6px', fontSize: '28px' }}>MeetHub App</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Video conferencing made simple
          </p>
        </div>

        <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>Create account</h3>

        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.15)',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#f87171',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Full Name
        </label>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: '16px',
            borderRadius: '8px', border: '1px solid #334155',
            background: '#0f172a', color: 'white', fontSize: '14px',
            boxSizing: 'border-box', outline: 'none'
          }}
        />

        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Email
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: '16px',
            borderRadius: '8px', border: '1px solid #334155',
            background: '#0f172a', color: 'white', fontSize: '14px',
            boxSizing: 'border-box', outline: 'none'
          }}
        />

        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Password
        </label>
        <input
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: '20px',
            borderRadius: '8px', border: '1px solid #334155',
            background: '#0f172a', color: 'white', fontSize: '14px',
            boxSizing: 'border-box', outline: 'none'
          }}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            background: loading ? '#15803d' : '#16a34a',
            color: 'white', border: 'none', borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px', fontWeight: '500',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', color: '#64748b', marginTop: '20px', fontSize: '14px' }}>
          Already have an account?{' '}
          <a href="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}

export default Register;