import { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BinList({ bins, fetchData }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [formData, setFormData] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    fill_level: '',
    status: 'empty',
  });

  const handleAddBin = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/bins`, {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        fill_level: parseInt(formData.fill_level),
      });
      toast.success('Bin added successfully');
      setIsAddDialogOpen(false);
      setFormData({ location_name: '', latitude: '', longitude: '', fill_level: '', status: 'empty' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add bin');
    }
  };

  const handleUpdateBin = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/bins/${editingBin.id}`, {
        fill_level: parseInt(formData.fill_level),
        status: formData.status,
      });
      toast.success('Bin updated successfully');
      setIsEditDialogOpen(false);
      setEditingBin(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update bin');
    }
  };

  const handleDeleteBin = async (binId) => {
    if (window.confirm('Are you sure you want to delete this bin?')) {
      try {
        await axios.delete(`${API}/bins/${binId}`);
        toast.success('Bin deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete bin');
      }
    }
  };

  const openEditDialog = (bin) => {
    setEditingBin(bin);
    setFormData({
      location_name: bin.location_name,
      latitude: bin.latitude,
      longitude: bin.longitude,
      fill_level: bin.fill_level,
      status: bin.status,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Bin Management</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-bin-button">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Bin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Bin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddBin} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Location Name</label>
                <Input
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  required
                  data-testid="location-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    required
                    data-testid="latitude-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    required
                    data-testid="longitude-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Fill Level (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.fill_level}
                  onChange={(e) => setFormData({ ...formData, fill_level: e.target.value })}
                  required
                  data-testid="fill-level-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger data-testid="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empty">Empty</SelectItem>
                    <SelectItem value="half-full">Half-Full</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" data-testid="submit-add-bin">
                Add Bin
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bins.map((bin) => (
          <Card key={bin.id} className="hover:shadow-lg transition-shadow" data-testid={`bin-card-${bin.id}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-start justify-between">
                <span>{bin.location_name}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    bin.status === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : bin.status === 'full'
                      ? 'bg-orange-100 text-orange-700'
                      : bin.status === 'half-full'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {bin.status.replace('-', ' ')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Fill Level: <strong className="text-gray-900">{bin.fill_level}%</strong></p>
                <p>Coordinates: <strong className="text-gray-900">{bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}</strong></p>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEditDialog(bin)}
                    data-testid={`edit-bin-${bin.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteBin(bin.id)}
                    data-testid={`delete-bin-${bin.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBin} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Location Name</label>
              <Input value={formData.location_name} disabled />
            </div>
            <div>
              <label className="text-sm font-medium">Fill Level (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.fill_level}
                onChange={(e) => setFormData({ ...formData, fill_level: e.target.value })}
                required
                data-testid="edit-fill-level-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger data-testid="edit-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">Empty</SelectItem>
                  <SelectItem value="half-full">Half-Full</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" data-testid="submit-edit-bin">
              Update Bin
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}