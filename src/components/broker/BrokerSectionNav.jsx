import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BrokerSectionNav({ currentSection, onSelect, horizontal = false }) {
    const sections = [
        { id: 'general', label: 'General info' },
        { id: 'ssp-config', label: 'SSP Configuration' },
        { id: 'content', label: 'Contents', nested: true },
        { id: 'data-centers', label: 'Data centers', nested: true },
        { id: 'ad-transformation', label: 'Ad transform', nested: true },
        { id: 'targeting', label: 'Targeting' }
    ];

    const handleSelect = (targetId) => {
        if (onSelect) onSelect(targetId);
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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
                <CardTitle className="text-sm text-slate-800">Broker partners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                {sections.map((s) => (
                    <Button
                        key={s.id}
                        variant="ghost"
                        className={`w-full justify-start h-8 text-xs ${s.nested ? 'pl-6' : ''} ${currentSection === s.id ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]' : 'text-slate-700 hover:bg-slate-50'}`}
                        onClick={() => handleSelect(s.id)}
                    >
                        {s.label}
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}


