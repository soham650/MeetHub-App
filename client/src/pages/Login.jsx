import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) return setError('Please fill in all fields');
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/room');

    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ color: 'white', margin: '0 0 6px', fontSize: '28px' }}>MeetHub App</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Video conferencing made simple
          </p>
        </div>

        <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>Welcome back</h3>

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
          Email
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          style={{
            width: '100%',
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: 'white',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />

        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Password
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          style={{
            width: '100%',
            padding: '10px 14px',
            marginBottom: '20px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: 'white',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#1d4ed8' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '500',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', color: '#64748b', marginTop: '20px', fontSize: '14px' }}>
          No account?{' '}
          <a href="/register" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login;