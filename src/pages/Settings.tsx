import { useState } from 'react';
import { Settings as SettingsIcon, Globe, Calendar, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5678');
  const [defaultFromDate, setDefaultFromDate] = useState('23');
  const [defaultToDate, setDefaultToDate] = useState('22');
  const [currency, setCurrency] = useState('BHD');
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure your Spending Tracker preferences</p>
      </div>

      {/* API Configuration */}
      <div className="kpi-card">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">API Configuration</h3>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">n8n API Base URL</Label>
            <Input
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="http://localhost:5678"
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              The base URL for your n8n instance API endpoints
            </p>
          </div>
          
          <Button variant="outline" size="sm">
            Test Connection
          </Button>
        </div>
      </div>

      {/* Date Preferences */}
      <div className="kpi-card">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Date Preferences</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default-from">Default From Date (Day of Month)</Label>
            <Input
              id="default-from"
              type="number"
              min="1"
              max="31"
              value={defaultFromDate}
              onChange={(e) => setDefaultFromDate(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Default start day for monthly reports (e.g., 23rd of previous month)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="default-to">Default To Date (Day of Month)</Label>
            <Input
              id="default-to"
              type="number"
              min="1"
              max="31"
              value={defaultToDate}
              onChange={(e) => setDefaultToDate(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Default end day for monthly reports (e.g., 22nd of current month)
            </p>
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="kpi-card">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Display Preferences</h3>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
            >
              <option value="BHD">BHD - Bahraini Dinar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Currently enabled by default</p>
            </div>
            <div className="w-12 h-6 bg-primary rounded-full flex items-center justify-end p-1">
              <div className="w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="kpi-card">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Security</h3>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-2">API Key Status</p>
            <p className="text-sm text-muted-foreground">
              N8N_API_KEY is managed server-side for security. API keys are never exposed to the browser.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Clear Cache
            </Button>
            <Button variant="outline" size="sm">
              Export Data
            </Button>
          </div>
        </div>
      </div>

      {/* Save Changes */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Reset to Defaults</Button>
        <Button className="gradient-primary text-white">Save Changes</Button>
      </div>
    </div>
  );
}