
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ArrowDownAZ, ArrowDownUp, ArrowUpDown, MoreHorizontal, Check } from 'lucide-react';

export type SortOption = 'recent_grouped' | 'alphabetical' | 'date_desc' | 'date_asc';

interface SortDropdownProps {
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ sortOption, setSortOption }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const sortOptions: { id: SortOption; label: string; icon: React.ReactNode }[] = [
        { id: 'recent_grouped', label: t('sort_recent_grouped'), icon: <Clock size={16} /> },
        { id: 'alphabetical', label: t('sort_alphabetical'), icon: <ArrowDownAZ size={16} /> },
        { id: 'date_desc', label: t('sort_recent_to_oldest'), icon: <ArrowDownUp size={16} /> },
        { id: 'date_asc', label: t('sort_oldest_to_recent'), icon: <ArrowUpDown size={16} /> },
    ];

    const currentOption = sortOptions.find(opt => opt.id === sortOption) || sortOptions[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(prev => !prev)} className="flex items-center gap-2 text-sm text-text-primary font-medium p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                {currentOption.icon}
                <span>{currentOption.label}</span>
                <MoreHorizontal size={14} className="text-text-secondary" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-background rounded-lg shadow-lg border border-border-color z-20 origin-top-left animate-fade-in-fast">
                    <ul className="p-2">
                        {sortOptions.map(option => (
                            <li key={option.id}>
                                <button
                                    onClick={() => { setSortOption(option.id); setIsOpen(false); }}
                                    className="w-full flex items-center justify-between p-2 text-sm rounded-md text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        {option.icon}
                                        <span>{option.label}</span>
                                    </div>
                                    {sortOption === option.id && <Check size={16} className="text-accent-start" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SortDropdown;
