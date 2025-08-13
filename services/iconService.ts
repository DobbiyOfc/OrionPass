import React, { FC } from 'react';
import { iconList, iconComponents } from '../components/icons';
import clsx from 'clsx';
import { Check } from 'lucide-react';

interface IconPickerProps {
    selectedIcon: string;
    onSelect: (iconName: string) => void;
}

/**
 * A UI component for selecting an icon from a predefined list.
 * This component is now standalone as icon storage is handled by the backend.
 */
const IconPicker: FC<IconPickerProps> = ({ selectedIcon, onSelect }) => {
    return React.createElement(
        'div',
        { className: "grid grid-cols-6 gap-2" },
        ...iconList.map(iconName => {
            const IconComponent = iconComponents[iconName];
            const isSelected = selectedIcon === iconName;
            return React.createElement(
                'button',
                {
                    key: iconName,
                    type: 'button',
                    onClick: () => onSelect(iconName),
                    className: clsx(
                        "relative flex items-center justify-center w-11 h-11 rounded-lg border-2 transition-all",
                        isSelected ? 'border-accent-start' : 'border-border-color/20 hover:border-border-color/50'
                    ),
                    'aria-label': `Select ${iconName} icon`
                },
                IconComponent && React.createElement(IconComponent, { size: 24, className: 'text-text-primary' }),
                isSelected && React.createElement(
                    'div',
                    { className: "absolute -top-1.5 -right-1.5 h-5 w-5 bg-accent-start text-white rounded-full flex items-center justify-center border-2 border-panel" },
                    React.createElement(Check, { size: 12, strokeWidth: 3 })
                )
            );
        })
    );
};

// The service now only exports the IconPicker component.
export const iconService = {
    IconPicker
};
