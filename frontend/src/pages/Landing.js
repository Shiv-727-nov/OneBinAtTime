import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Landing({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
      });

      const userData = response.data;
      setUser(userData);
      toast.success(`Welcome, ${userData.name}!`);

      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (userData.role === 'driver') {
        navigate('/driver');
      }
    } catch (error) {
      toast.error('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role) => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('driver');
      setPassword('driver123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">EcoWaste Manager</h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row items-center justify-between min-h-screen px-6 lg:px-16 pt-24 pb-12">
        {/* Left side - Content */}
        <div className="flex-1 max-w-2xl mb-12 lg:mb-0">
          <div className="inline-block px-4 py-2 bg-emerald-100 rounded-full mb-6">
            <span className="text-emerald-700 font-medium text-sm">Smart Waste Management System</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Optimize Your Waste Collection Routes
          </h2>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Intelligent bin monitoring, real-time status tracking, and AI-powered route optimization for efficient waste management operations.
          </p>
          
          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Real-time Monitoring</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Route Optimization</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Smart Analytics</span>
            </div>
          </div>
        </div>

        {/* Right side - Login Card */}
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0" data-testid="login-card">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
              <CardDescription>Enter your credentials to access the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="username-input"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="password-input"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-medium"
                  disabled={loading}
                  data-testid="login-button"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Demo Accounts</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDemoLogin('admin')}
                    className="h-11 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                    data-testid="demo-admin-button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Admin Demo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDemoLogin('driver')}
                    className="h-11 border-teal-200 hover:bg-teal-50 hover:border-teal-300"
                    data-testid="demo-driver-button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Driver Demo
                  </Button>
                </div>

                <div className="mt-4 text-xs text-center text-gray-500 space-y-1">
                  <p>Admin: admin / admin123</p>
                  <p>Driver: driver / driver123</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}