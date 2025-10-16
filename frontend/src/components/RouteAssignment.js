import { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RouteAssignment({ bins, drivers, routes, fetchData }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedBins, setSelectedBins] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState(null);

  const handleOptimizeRoute = async () => {
    if (selectedBins.length === 0) {
      toast.error('Please select at least one bin');
      return;
    }

    try {
      // Use first bin as starting point for optimization
      const firstBin = bins.find((b) => b.id === selectedBins[0]);
      const response = await axios.post(`${API}/routes/optimize`, {
        start_lat: firstBin.latitude,
        start_lng: firstBin.longitude,
        bin_ids: selectedBins,
      });
      setOptimizedRoute(response.data);
      setSelectedBins(response.data.optimized_order);
      toast.success('Route optimized successfully!');
    } catch (error) {
      toast.error('Failed to optimize route');
    }
  };

  const handleAssignRoute = async () => {
    if (!selectedDriver) {
      toast.error('Please select a driver');
      return;
    }
    if (selectedBins.length === 0) {
      toast.error('Please select at least one bin');
      return;
    }

    try {
      await axios.post(`${API}/routes`, {
        driver_id: selectedDriver,
        bin_ids: selectedBins,
      });
      toast.success('Route assigned successfully!');
      setIsDialogOpen(false);
      setSelectedDriver('');
      setSelectedBins([]);
      setOptimizedRoute(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign route');
    }
  };

  const toggleBinSelection = (binId) => {
    setSelectedBins((prev) =>
      prev.includes(binId) ? prev.filter((id) => id !== binId) : [...prev, binId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Route Assignment</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="assign-route-button">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Route to Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Driver</label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger data-testid="driver-select">
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Select Bins</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleOptimizeRoute}
                    disabled={selectedBins.length === 0}
                    data-testid="optimize-route-button"
                  >
                    Optimize Route
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {bins
                    .filter((bin) => bin.status === 'critical' || bin.status === 'full' || bin.status === 'half-full')
                    .map((bin) => (
                      <div key={bin.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                        <Checkbox
                          checked={selectedBins.includes(bin.id)}
                          onCheckedChange={() => toggleBinSelection(bin.id)}
                          data-testid={`bin-checkbox-${bin.id}`}
                        />
                        <label className="flex-1 text-sm cursor-pointer">
                          <span className="font-medium">{bin.location_name}</span>
                          <span className="text-gray-500 ml-2">({bin.fill_level}% - {bin.status})</span>
                        </label>
                      </div>
                    ))}
                </div>
              </div>

              {optimizedRoute && (
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-emerald-900">
                    Optimized route with {selectedBins.length} bins
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Estimated distance: {optimizedRoute.total_distance} km
                  </p>
                </div>
              )}

              <Button
                onClick={handleAssignRoute}
                className="w-full"
                disabled={!selectedDriver || selectedBins.length === 0}
                data-testid="confirm-assign-route"
              >
                Assign Route
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map((route) => {
          const routeBins = bins.filter((bin) => route.bin_ids.includes(bin.id));
          return (
            <Card key={route.id} className="hover:shadow-lg transition-shadow" data-testid={`route-card-${route.id}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-start justify-between">
                  <span>{route.driver_name}</span>
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Bins: <strong className="text-gray-900">{route.bin_ids.length}</strong></p>
                  <p className="text-xs">
                    Created: {new Date(route.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-3 space-y-1">
                    {routeBins.slice(0, 3).map((bin) => (
                      <div key={bin.id} className="text-xs bg-gray-50 p-2 rounded">
                        {bin.location_name} ({bin.fill_level}%)
                      </div>
                    ))}
                    {routeBins.length > 3 && (
                      <p className="text-xs text-gray-500">+{routeBins.length - 3} more bins</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}