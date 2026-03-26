import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DspSectionNav({ currentSection, onSelect, horizontal = false }) {
    const sections = [
        { id: 'basic', label: 'Basic info' },
        { id: 'inventory', label: 'Inventory Access' },
        { id: 'endpoints', label: 'Partner Endpoints' },
        { id: 'advanced', label: 'Advanced Settings' },
        { id: 'targeting', label: 'Targeting' },
        { id: 'block-creative', label: 'Block Creative' },
    ];

    const handleSelect = (id) => {
        if (onSelect) onSelect(id);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Horizontal layout
    if (horizontal) {
        return (
            <div className="flex items-center gap-1 border-b border-slate-200">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                            currentSection === s.id
                                ? 'text-[rgb(75,99,226)] border-[rgb(75,99,226)]'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                        }`}
                        onClick={() => handleSelect(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
        );
    }

    // Vertical layout (original)
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="text-sm text-slate-800">DSP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                {sections.map((s) => (
                    <Button
                        key={s.id}
                        variant="ghost"
                        className={`w-full justify-start h-8 text-xs ${currentSection === s.id ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]' : 'text-slate-700 hover:bg-slate-50'}`}
                        onClick={() => handleSelect(s.id)}
                    >
                        {s.label}
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}


