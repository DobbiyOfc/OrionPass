
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Item, LoginItem, NoteItem } from '../../types';
import { SortOption } from './SortDropdown';
import SortDropdown from './SortDropdown';
import { 
    Loader, AppWindow, KeySquare, Trash2, User, Edit, StickyNote, MoreHorizontal, 
    ArrowRightLeft
} from 'lucide-react';

const Favicon: React.FC<{ url: string; fallback: React.ReactNode }> = ({ url, fallback }) => {
    const [hasError, setHasError] = useState(false);

    const faviconUrl = useMemo(() => {
        if (!url) return null;
        try {
            // Ensure the URL has a protocol for the URL constructor to work.
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            const urlObject = new URL(fullUrl);
            const hostname = urlObject.hostname;
            // Using Google's public favicon service as a proxy to protect user privacy.
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        } catch (e) {
            console.warn(`Invalid URL for favicon: ${url}`);
            return null;
        }
    }, [url]);

    useEffect(() => {
        setHasError(false);
    }, [url]);

    if (hasError || !faviconUrl) {
        return <>{fallback}</>;
    }

    return (
        <img
            src={faviconUrl}
            alt="" // Decorative
            className="h-5 w-5 rounded"
            onError={() => setHasError(true)}
        />
    );
};

interface ItemListProps {
    items: Item[], 
    isLoading: boolean, 
    selectedItemId: string | null, 
    sortOption: SortOption,
    onSelectItem: (id: string) => void,
    onEdit: (item: Item) => void,
    onMove: (item: Item) => void,
    onDelete: (item: Item) => void,
    onSortChange: (option: SortOption) => void
}

const ItemList: React.FC<ItemListProps> = ({ items, isLoading, selectedItemId, sortOption, onSelectItem, onEdit, onMove, onDelete, onSortChange }) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    
    const groupItemsForRecentView = useCallback((itemsToSort: Item[]) => {
        const groups: { [key: string]: Item[] } = {
            today: [],
            yesterday: [],
            previous_7_days: [],
            previous_30_days: [],
            older: []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(new Date().setDate(today.getDate() - 1));
        const sevenDaysAgo = new Date(new Date().setDate(today.getDate() - 7));
        const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

        itemsToSort.forEach(item => {
            const itemDate = new Date(item.updatedAt);
            if (itemDate >= today) groups.today.push(item);
            else if (itemDate >= yesterday) groups.yesterday.push(item);
            else if (itemDate >= sevenDaysAgo) groups.previous_7_days.push(item);
            else if (itemDate >= thirtyDaysAgo) groups.previous_30_days.push(item);
            else groups.older.push(item);
        });
        
        return groups;
    }, []);

    const groupedItems = useMemo(() => {
        if (sortOption !== 'recent_grouped') return null;
        return groupItemsForRecentView(items);
    }, [items, sortOption, t, groupItemsForRecentView]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openMenuId]);

    const getItemIcon = (item: Item) => {
        switch(item.type) {
            case 'login': return <User className="h-4 w-4 text-white" />;
            case 'note': return <StickyNote className="h-4 w-4 text-white" />;
            default: return <AppWindow className="h-4 w-4 text-white" />;
        }
    };
    
    const getItemSecondaryText = (item: Item) => {
        switch(item.type) {
            case 'login': return item.username;
            case 'note': return t('note_preview', { content: item.notes });
            default: return '';
        }
    }

    const ItemRow = ({ item }: { item: Item }) => (
         <li key={item.UUID_Identifier} className={clsx(
            "relative group rounded-lg transition-colors",
            selectedItemId === item.UUID_Identifier && "bg-black/10 dark:bg-white/10",
            openMenuId === item.UUID_Identifier && "z-20"
        )}>
            <button
                onClick={() => onSelectItem(item.UUID_Identifier)}
                className="w-full text-left p-3 rounded-lg flex items-start space-x-3"
            >
                <div className="p-2.5 bg-black/20 dark:bg-white/10 rounded-lg mt-0.5 flex-shrink-0 relative flex items-center justify-center">
                    <div className="absolute inset-0 accent-gradient opacity-30 rounded-lg"></div>
                     {item.type === 'login' && (item as LoginItem).url ? (
                        <Favicon url={(item as LoginItem).url} fallback={getItemIcon(item)} />
                    ) : (
                        getItemIcon(item)
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{item.title}</h3>
                    <p className="text-xs text-text-secondary truncate">{getItemSecondaryText(item)}</p>
                </div>
            </button>
            <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.UUID_Identifier ? null : item.UUID_Identifier);
                    }}
                    className={clsx("p-2 rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100", openMenuId === item.UUID_Identifier && "opacity-100")}
                    aria-label={t('more_options')}
                >
                    <MoreHorizontal size={18} />
                </button>
                {openMenuId === item.UUID_Identifier && (
                    <div
                        ref={menuRef}
                        className="absolute top-full right-0 mt-1 w-52 bg-background rounded-lg shadow-lg border border-border-color z-30 origin-top-right animate-fade-in-fast"
                    >
                        <ul className="py-1">
                            <li>
                                <button onClick={() => { onEdit(item); setOpenMenuId(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <Edit size={16} /> {t('edit')}
                                </button>
                            </li>
                            <li>
                                <button onClick={() => { onMove(item); setOpenMenuId(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <ArrowRightLeft size={16} /> {t('move_to_vault')}
                                </button>
                            </li>
                            <li>
                                <button onClick={() => { onDelete(item); setOpenMenuId(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                                    <Trash2 size={16} /> {t('delete')}
                                </button>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </li>
    );
    
    const groupOrder: (keyof typeof groupedItems)[] = ['today', 'yesterday', 'previous_7_days', 'previous_30_days', 'older'];
    const groupLabels: { [key: string]: string } = {
        today: t('date_group_today'),
        yesterday: t('date_group_yesterday'),
        previous_7_days: t('date_group_previous_7_days'),
        previous_30_days: t('date_group_previous_30_days'),
        older: t('date_group_older')
    };

    const renderGroupedList = () => (
        <ul className="p-1 space-y-0.5">
            {groupOrder.map(groupKey =>
                groupedItems && groupedItems[groupKey].length > 0 ? (
                    <React.Fragment key={groupKey}>
                        <li className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary tracking-wider sticky top-0 bg-panel/80 dark:bg-panel/30 backdrop-blur-sm z-10">
                            {groupLabels[groupKey]}
                        </li>
                        {groupedItems[groupKey].map(item => <ItemRow key={item.UUID_Identifier} item={item} />)}
                    </React.Fragment>
                ) : null
            )}
        </ul>
    );

    const renderFlatList = () => (
        <ul className="p-1 space-y-0.5">
            {items.map(item => <ItemRow key={item.UUID_Identifier} item={item} />)}
        </ul>
    );

    return (
    <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="p-2 border-b border-border-color/10 dark:border-white/5 flex-shrink-0">
            <SortDropdown sortOption={sortOption} setSortOption={onSortChange} />
        </div>
        
        {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <Loader className="animate-spin text-accent-start" size={32} />
            </div>
        ) : items.length > 0 ? (
             <div className="flex-1 overflow-y-auto">
                {sortOption === 'recent_grouped' ? renderGroupedList() : renderFlatList()}
            </div>
        ) : (
            <div className="text-center p-8 mt-10">
                <KeySquare size={40} className="mx-auto text-text-secondary opacity-50" />
                <p className="mt-4 text-text-secondary">{t('empty_vault_message')}</p>
                <p className="text-xs text-text-secondary mt-1">{t('empty_vault_prompt')}</p>
            </div>
        )}
    </div>
)};

export default ItemList;