import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import RouteDisplay from '../components/RouteDisplay';
import DriverRouteMap from '../components/DriverRouteMap';
import Chatbot from '../components/Chatbot';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DriverDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [bins, setBins] = useState([]);
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds if enabled
    let interval;
    if (autoRefreshEnabled) {
      interval = setInterval(() => {
        fetchData();
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user.id, autoRefreshEnabled]);

  const fetchData = async () => {
    try {
      // Fetch driver info - match by name since user IDs may not match driver IDs
      const driversRes = await axios.get(`${API}/drivers`);
      const driverDetails = driversRes.data.data.find(d => d.name === user.name || d.email.includes(user.username));
      
      if (!driverDetails) {
        // If no driver found, user might not have driver record yet
        toast.error('Driver profile not found. Please contact admin.');
        setLoading(false);
        return;
      }
      
      setDriverInfo(driverDetails);
      
      // Fetch routes using the actual driver_id from drivers collection
      const routesRes = await axios.get(`${API}/route-management/driver/${driverDetails.driver_id}`);
      const driverRoutes = routesRes.data.data || [];
      
      // Fetch bins data for all routes
      const binsRes = await axios.get(`${API}/bins`);
      const allBins = binsRes.data;
      
      // Attach bin details to each route
      const routesWithBins = driverRoutes.map(route => ({
        ...route,
        bins_details: allBins.filter(bin => route.bin_ids.includes(bin.id))
      }));
      
      setRoutes(routesWithBins);
      setBins(allBins);
      
      // Auto-select first active route
      const activeRoute = routesWithBins.find(r => r.status === 'in-progress' || r.status === 'assigned' || r.status === 'pending');
      if (activeRoute) {
        setSelectedRoute(activeRoute);
      } else if (routesWithBins.length > 0) {
        setSelectedRoute(routesWithBins[0]);
      }
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
    toast.success('Dashboard refreshed');
  };

  const getTodayRoutesCompleted = () => {
    const today = new Date().toDateString();
    return routes.filter(r => {
      if (!r.completed_at) return false;
      const completedDate = new Date(r.completed_at).toDateString();
      return completedDate === today && r.status === 'completed';
    }).length;
  };

  const getActiveRoutes = () => {
    return routes.filter(r => r.status === 'in-progress' || r.status === 'assigned' || r.status === 'pending');
  };

  const getPendingRoutes = () => {
    return routes.filter(r => r.status === 'assigned' || r.status === 'pending');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const activeRoutes = getActiveRoutes();
  const pendingRoutes = getPendingRoutes();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Driver Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {pendingRoutes.length > 0 && (
                <div className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg border border-yellow-200 text-sm font-medium">
                  {pendingRoutes.length} New Route{pendingRoutes.length > 1 ? 's' : ''}
                </div>
              )}
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="border-gray-300"
                data-testid="refresh-button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
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
              <Button
                onClick={() => setChatbotOpen(!chatbotOpen)}
                className="bg-teal-600 hover:bg-teal-700 ml-2"
                data-testid="open-chatbot-driver"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-teal-500" data-testid="active-routes-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Active Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{activeRoutes.length}</div>
              <p className="text-xs text-teal-600 mt-1">In progress or assigned</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-emerald-500" data-testid="completed-today-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{getTodayRoutesCompleted()}</div>
              <p className="text-xs text-emerald-600 mt-1">Routes finished</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-blue-500" data-testid="total-routes-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {driverInfo?.total_routes_completed || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Route Display */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <RouteDisplay 
                  routes={routes} 
                  driverId={driverInfo?.driver_id || user.id} 
                  onRouteUpdate={fetchData}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Map */}
          <div>
            {selectedRoute && selectedRoute.bins_details && selectedRoute.bins_details.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Route Map</CardTitle>
                </CardHeader>
                <CardContent>
                  <DriverRouteMap 
                    bins={selectedRoute.bins_details}
                    driverLocation={driverInfo?.current_location}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p>No active route to display</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Chatbot */}
      <Chatbot 
        userRole="driver" 
        userName={user.name}
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
      />
    </div>
  );
}