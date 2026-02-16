import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const u = username.trim();
    if (!u || !password) {
      setError('Nhập đầy đủ username và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      const fn = tab === 'login' ? auth.login : auth.register;
      const { token, user: userData } = await fn(username, password);
      login(token, userData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Game Tính Điểm</h1>
        <p className="subtitle">Đăng nhập để tạo hoặc tham gia phòng</p>
        <div className="login-tabs">
          <button type="button" className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
            Đăng nhập
          </button>
          <button type="button" className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
            Đăng ký
          </button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            className="form-input"
            placeholder="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            type="password"
            className="form-input"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Đang xử lý...' : tab === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>
      </div>
    </div>
  );
}
