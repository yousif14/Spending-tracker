import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Activity, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * API Debug Helper Component
 * 
 * This component helps diagnose API connection issues and verify data is being
 * pulled correctly from n8n. Add this to your Dashboard or Settings page temporarily
 * to debug any data loading issues.
 * 
 * Usage:
 * import { ApiDebugHelper } from '@/components/debug/ApiDebugHelper';
 * <ApiDebugHelper />
 */

export function ApiDebugHelper() {
  const [showDetails, setShowDetails] = useState(false);

  const { 
    data: transactions = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['debug-transactions', '2020-01-01', '2030-12-31'],
    queryFn: () => apiClient.getTransactions('2020-01-01', '2030-12-31'),
  });

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    if (error) return <XCircle className="w-5 h-5 text-red-500" />;
    if (transactions.length > 0) return <CheckCircle className="w-5 h-5 text-green-500" />;
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (error) return 'Error connecting to API';
    if (transactions.length === 0) return 'No transactions found';
    return `Successfully loaded ${transactions.length} transactions`;
  };

  const getStatusColor = () => {
    if (isLoading) return 'bg-blue-50 border-blue-200';
    if (error) return 'bg-red-50 border-red-200';
    if (transactions.length === 0) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <Card className={`p-6 ${getStatusColor()} border-2`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-bold text-foreground">API Debug Helper</h3>
            <p className="text-sm text-muted-foreground">Verifying n8n connection</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Display */}
      <div className="flex items-center gap-3 mb-4 p-4 bg-white/50 rounded-lg">
        {getStatusIcon()}
        <div className="flex-1">
          <p className="font-medium text-foreground">{getStatusText()}</p>
          {error && (
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-white/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
          </div>
          <div className="p-3 bg-white/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Date Range</p>
            <p className="text-sm font-semibold text-foreground">
              {transactions[0]?.date || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">to</p>
            <p className="text-sm font-semibold text-foreground">
              {transactions[transactions.length - 1]?.date || 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-white/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold text-foreground">
              BHD {transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(3)}
            </p>
          </div>
          <div className="p-3 bg-white/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Unique Merchants</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(transactions.map(t => t.merchant)).size}
            </p>
          </div>
        </div>
      )}

      {/* Debug Details Toggle */}
      {!isLoading && transactions.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="mb-2"
          >
            {showDetails ? 'Hide' : 'Show'} Technical Details
          </Button>

          {showDetails && (
            <div className="space-y-4">
              {/* API Configuration */}
              <div className="p-4 bg-white/50 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">API Configuration</h4>
                <div className="space-y-1 text-sm font-mono">
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Base URL:</span>{' '}
                    {import.meta.env.VITE_API_BASE_URL || 'https://n8n.11homelab.cc'}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Endpoint:</span> /webhook/api/transactions
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Date Range:</span> 2020-01-01 to 2030-12-31
                  </p>
                </div>
              </div>

              {/* Sample Transaction */}
              <div className="p-4 bg-white/50 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Sample Transaction</h4>
                <pre className="text-xs overflow-auto p-3 bg-gray-100 rounded">
                  {JSON.stringify(transactions[0], null, 2)}
                </pre>
              </div>

              {/* Data Structure Validation */}
              <div className="p-4 bg-white/50 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Data Structure Validation</h4>
                <div className="space-y-2 text-sm">
                  {[
                    { field: 'SN', check: !!transactions[0]?.SN },
                    { field: 'date', check: !!transactions[0]?.date },
                    { field: 'merchant', check: !!transactions[0]?.merchant },
                    { field: 'amount', check: typeof transactions[0]?.amount === 'number' },
                    { field: 'category', check: !!transactions[0]?.category },
                  ].map(({ field, check }) => (
                    <div key={field} className="flex items-center gap-2">
                      {check ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={check ? 'text-foreground' : 'text-red-600'}>
                        {field}: {check ? 'Valid' : 'Missing or Invalid'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">✓ Recommendations</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  {transactions.length < 100 && (
                    <li>Transaction count is low. Verify n8n Data Tables contain all transactions.</li>
                  )}
                  {transactions.length >= 100 && transactions.length < 500 && (
                    <li>Good transaction count. Dashboard should display correctly.</li>
                  )}
                  {transactions.length >= 500 && (
                    <li>Excellent! Large dataset loaded successfully.</li>
                  )}
                  <li>If numbers don't match n8n, check the date range in the API query.</li>
                  <li>Clear browser cache and refresh if data seems stale.</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error Details */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-900 mb-2">Error Details</h4>
          <p className="text-sm text-red-800 mb-3">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Verify n8n instance is running at https://n8n.11homelab.cc</li>
              <li>Check n8n workflow is active and webhook is configured</li>
              <li>Verify API key in .env file is correct</li>
              <li>Check browser console for CORS errors</li>
              <li>Test the webhook URL directly in browser</li>
            </ol>
          </div>
        </div>
      )}

      {/* No Data Warning */}
      {!isLoading && !error && transactions.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">⚠️ No Transactions Found</h4>
          <p className="text-sm text-yellow-800 mb-3">
            The API connection is working, but no transactions were returned.
          </p>
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Possible Causes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>n8n Data Tables are empty</li>
              <li>Date range doesn't match any transactions</li>
              <li>n8n workflow is not returning data correctly</li>
              <li>Data format from n8n doesn't match expected structure</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

export default ApiDebugHelper;