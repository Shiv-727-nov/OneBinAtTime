import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RouteDisplay({ routes, driverId, onRouteUpdate }) {
  const [loading, setLoading] = useState(false);
  const [processingRouteId, setProcessingRouteId] = useState(null);

  const startRoute = async (routeId) => {
    setLoading(true);
    setProcessingRouteId(routeId);
    try {
      await axios.put(`${API}/route-management/${routeId}/start`);
      toast.success('Route started successfully!');
      onRouteUpdate();
    } catch (error) {
      toast.error('Failed to start route');
      console.error(error);
    } finally {
      setLoading(false);
      setProcessingRouteId(null);
    }
  };

  const collectBin = async (binId) => {
    setLoading(true);
    try {
      await axios.put(`${API}/bins/${binId}/collect`, { driver_id: driverId });
      toast.success('Bin marked as collected!');
      onRouteUpdate();
    } catch (error) {
      toast.error('Failed to mark bin as collected');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const completeRoute = async (routeId) => {
    setLoading(true);
    setProcessingRouteId(routeId);
    try {
      await axios.put(`${API}/route-management/${routeId}/complete`);
      toast.success('Route completed! Great work!');
      onRouteUpdate();
    } catch (error) {
      toast.error('Failed to complete route');
      console.error(error);
    } finally {
      setLoading(false);
      setProcessingRouteId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getBinStatusColor = (status) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'full':
        return 'bg-orange-100 text-orange-700';
      case 'half-full':
        return 'bg-yellow-100 text-yellow-700';
      case 'empty':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateProgress = (route, bins) => {
    const collectedBins = bins.filter((bin) => bin.status === 'empty' || bin.fill_level < 15);
    return {
      collected: collectedBins.length,
      total: bins.length,
      percentage: bins.length > 0 ? Math.round((collectedBins.length / bins.length) * 100) : 0,
    };
  };

  if (!routes || routes.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium">No routes assigned yet</p>
            <p className="text-sm mt-2">Routes will appear here when assigned by admin</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {routes.map((route) => {
        const bins = route.bins_details || [];
        const progress = calculateProgress(route, bins);

        return (
          <Card key={route.id} className="border-2" data-testid={`route-card-${route.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Route #{route.id.slice(0, 8)}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {bins.length} bins • Est. {route.estimated_duration || 0} min
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                    route.status
                  )}`}
                  data-testid={`route-status-${route.id}`}
                >
                  {route.status.replace('-', ' ').toUpperCase()}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {/* Progress Bar */}
              {route.status === 'in-progress' && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">Progress</span>
                    <span className="text-gray-600">
                      {progress.collected} of {progress.total} bins collected
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bins List */}
              <div className="space-y-2 mb-4">
                {bins.map((bin, index) => (
                  <div
                    key={bin.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    data-testid={`bin-item-${bin.id}`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{bin.location_name}</p>
                      <p className="text-xs text-gray-500">
                        {bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getBinStatusColor(
                          bin.status
                        )}`}
                      >
                        {bin.fill_level}%
                      </span>
                      {route.status === 'in-progress' && (
                        <Button
                          size="sm"
                          variant={bin.status === 'empty' ? 'outline' : 'default'}
                          disabled={bin.status === 'empty' || loading}
                          onClick={() => collectBin(bin.id)}
                          className={
                            bin.status === 'empty'
                              ? 'border-green-600 text-green-600'
                              : 'bg-teal-600 hover:bg-teal-700'
                          }
                          data-testid={`collect-bin-${bin.id}`}
                        >
                          {bin.status === 'empty' ? '✓ Collected' : 'Collect'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {(route.status === 'assigned' || route.status === 'pending') && (
                  <Button
                    onClick={() => startRoute(route.id)}
                    disabled={loading || processingRouteId === route.id}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 font-medium"
                    data-testid={`start-route-${route.id}`}
                  >
                    {processingRouteId === route.id ? 'Starting...' : 'Start Collection'}
                  </Button>
                )}

                {route.status === 'in-progress' && (
                  <Button
                    onClick={() => completeRoute(route.id)}
                    disabled={loading || progress.collected < progress.total || processingRouteId === route.id}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-medium"
                    data-testid={`complete-route-${route.id}`}
                  >
                    {processingRouteId === route.id
                      ? 'Completing...'
                      : progress.collected < progress.total
                      ? `Collect All Bins (${progress.total - progress.collected} remaining)`
                      : 'Complete Route'}
                  </Button>
                )}

                {route.status === 'completed' && (
                  <div className="flex-1 text-center py-2 bg-green-50 text-green-700 rounded font-medium">
                    ✓ Completed
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
