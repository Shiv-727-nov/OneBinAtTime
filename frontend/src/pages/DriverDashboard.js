import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import LeafletDriverMap from '../components/LeafletDriverMap';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DriverDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [routesRes, binsRes] = await Promise.all([
        axios.get(`${API}/routes/driver/${user.id}`),
        axios.get(`${API}/bins`),
      ]);
      setRoutes(routesRes.data);
      setBins(binsRes.data);
      
      // Auto-select first pending route
      const pendingRoute = routesRes.data.find((r) => r.status === 'pending');
      if (pendingRoute) {
        setSelectedRoute(pendingRoute);
      }
    } catch (error) {
      toast.error('Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleStartRoute = async (routeId) => {
    try {
      await axios.put(`${API}/routes/${routeId}/status?status=in-progress`);
      toast.success('Route started!');
      fetchData();
    } catch (error) {
      toast.error('Failed to start route');
    }
  };

  const handleCompleteRoute = async (routeId) => {
    try {
      await axios.put(`${API}/routes/${routeId}/status?status=completed`);
      toast.success('Route completed!');
      fetchData();
    } catch (error) {
      toast.error('Failed to complete route');
    }
  };

  const getRouteBins = (route) => {
    return bins.filter((bin) => route.bin_ids.includes(bin.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading routes...</p>
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

      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Routes List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Routes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {routes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No routes assigned</p>
                  </div>
                ) : (
                  routes.map((route) => (
                    <div
                      key={route.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRoute?.id === route.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => setSelectedRoute(route)}
                      data-testid={`route-${route.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">Route #{route.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-500">{route.bin_ids.length} bins</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            route.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : route.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {route.status}
                        </span>
                      </div>
                      
                      {route.status === 'pending' && (
                        <Button
                          size="sm"
                          className="w-full mt-2 bg-teal-600 hover:bg-teal-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRoute(route.id);
                          }}
                          data-testid={`start-route-${route.id}`}
                        >
                          Start Route
                        </Button>
                      )}
                      
                      {route.status === 'in-progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 border-green-600 text-green-600 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteRoute(route.id);
                          }}
                          data-testid={`complete-route-${route.id}`}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map and Bin Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRoute ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Route Map & Navigation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DriverMapView route={selectedRoute} bins={getRouteBins(selectedRoute)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Bins to Collect</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getRouteBins(selectedRoute).map((bin, index) => (
                        <div
                          key={bin.id}
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                          data-testid={`bin-item-${bin.id}`}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{bin.location_name}</p>
                            <p className="text-sm text-gray-500">
                              {bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                bin.status === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : bin.status === 'full'
                                  ? 'bg-orange-100 text-orange-700'
                                  : bin.status === 'half-full'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {bin.fill_level}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p>Select a route to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}