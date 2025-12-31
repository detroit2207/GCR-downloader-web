import React from 'react';

const Login = () => {
  const handleLogin = () => {
    window.location.href = "http://localhost:8000/auth/login";
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '2rem', color: '#1a73e8' }}>Google Classroom Downloader</h1>
        <button 
          onClick={handleLogin}
          style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            backgroundColor: '#1a73e8', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
