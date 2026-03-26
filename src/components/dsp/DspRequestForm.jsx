
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2, Zap } from "lucide-react";

export default function DspRequestForm({
  partnerId,
  setPartnerId,
  authToken,
  setAuthToken,
  onExecute,
  loading
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onExecute();
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
        <CardTitle className="text-xl flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          DSP
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="partnerId" className="text-sm font-semibold text-slate-700">
              Partner ID
            </Label>
            <Input
              id="partnerId"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="Enter partner ID"
              className="font-mono text-sm border-slate-300 focus:border-[rgb(75,99,226)] focus:ring-[rgb(75,99,226)]"
              disabled={loading}
            />
          </div>

          {/* Authentication Token field is now automatically managed - hidden from UI */}

          <Button
            type="submit"
            disabled={loading || !partnerId?.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Executing Request...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-3" />
                Execute API Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
