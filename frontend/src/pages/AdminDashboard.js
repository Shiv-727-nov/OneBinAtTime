import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import LeafletMap from '../components/LeafletMap';
import BinList from '../components/BinList';
import RouteAssignment from '../components/RouteAssignment';
import Chatbot from '../components/Chatbot';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [bins, setBins] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [binsRes, driversRes, routesRes] = await Promise.all([
        axios.get(`${API}/bins`),
        axios.get(`${API}/users/drivers`),
        axios.get(`${API}/routes`),
      ]);
      setBins(binsRes.data);
      setDrivers(driversRes.data);
      setRoutes(routesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  const getStatusCounts = () => {
    const counts = {
      critical: bins.filter((b) => b.status === 'critical').length,
      full: bins.filter((b) => b.status === 'full').length,
      halfFull: bins.filter((b) => b.status === 'half-full').length,
      empty: bins.filter((b) => b.status === 'empty').length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-gray-300"
              data-testid="logout-button"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="overview-tab"
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('bins')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'bins'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="bins-tab"
            >
              Bin Management
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'routes'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="routes-tab"
            >
              Route Assignment
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-red-500" data-testid="critical-bins-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Critical Bins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statusCounts.critical}</div>
                  <p className="text-xs text-red-600 mt-1">Requires immediate attention</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500" data-testid="full-bins-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Full Bins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statusCounts.full}</div>
                  <p className="text-xs text-orange-600 mt-1">Ready for collection</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500" data-testid="half-full-bins-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Half-Full Bins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statusCounts.halfFull}</div>
                  <p className="text-xs text-yellow-600 mt-1">Monitor closely</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500" data-testid="empty-bins-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Empty Bins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statusCounts.empty}</div>
                  <p className="text-xs text-emerald-600 mt-1">No action needed</p>
                </CardContent>
              </Card>
            </div>

            {/* Map */}
            <Card>
              <CardHeader>
                <CardTitle>Live Bin Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <LeafletMap bins={bins} />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'bins' && <BinList bins={bins} fetchData={fetchData} />}

        {activeTab === 'routes' && (
          <RouteAssignment bins={bins} drivers={drivers} routes={routes} fetchData={fetchData} />
        )}
      </main>

      {/* Floating AI Assistant Button */}
      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-40"
          data-testid="floating-chat-button"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* Chatbot */}
      <Chatbot 
        userRole="admin" 
        userName={user.name}
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
      />
    </div>
  );
}