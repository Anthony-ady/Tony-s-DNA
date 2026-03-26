import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldBan, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const BLOCK_CREATIVE_URL = 'https://bo-api.omnitagjs.com/bo-api/blocked_creative/manual';

export default function DspBlockCreative({ partnerUid, authToken }) {
  const [creativeId, setCreativeId] = useState('');
  const [partnerId, setPartnerId] = useState(partnerUid || '');
  const [publisherId, setPublisherId] = useState('');
  const [realmId, setRealmId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!creativeId.trim() || !partnerId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const body = {
      creative_id: creativeId.trim(),
      partner_id: partnerId.trim(),
      ...(publisherId.trim() ? { publisher_id: publisherId.trim() } : { publisher_id: null }),
      ...(realmId.trim() ? { realm_id: realmId.trim() } : { realm_id: null }),
    };

    try {
      const response = await fetch(BLOCK_CREATIVE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': authToken || '',
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${typeof json === 'string' ? json : JSON.stringify(json)}`);
      }

      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <ShieldBan className="w-5 h-5 text-red-500" />
          Block Creative
        </CardTitle>
        <p className="text-xs text-slate-500">
          Manually block a creative on this partner (or on a specific publisher / realm).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="bc-creative-id">
                Creative ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bc-creative-id"
                placeholder="cr-u7tz5k6pufse08slosj"
                value={creativeId}
                onChange={(e) => setCreativeId(e.target.value)}
                className="bg-white font-mono text-sm"
                required
              />
            </div>
            <input type="hidden" value={partnerId} readOnly />
            <div className="space-y-1">
              <Label htmlFor="bc-publisher-id">
                Publisher ID <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="bc-publisher-id"
                placeholder="company_uid"
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
                className="bg-white font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bc-realm-id">
                Realm ID <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="bc-realm-id"
                placeholder="realm_uid"
                value={realmId}
                onChange={(e) => setRealmId(e.target.value)}
                className="bg-white font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={loading || !creativeId.trim() || !partnerId.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldBan className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Blocking...' : 'Block Creative'}
            </Button>
          </div>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs font-mono break-all">{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              Creative successfully blocked
            </div>
            <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs font-mono overflow-auto text-slate-700">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
