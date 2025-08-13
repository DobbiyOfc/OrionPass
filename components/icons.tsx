import React from 'react';
import {
    Home,
    Briefcase,
    Heart,
    KeySquare,
    CreditCard,
    Shield,
    Star,
    Book,
    Plane,
    ShoppingCart,
    Server,
    Cloud,
    Folder,
    University,
    Gamepad2,
    Music,
    LucideProps,
} from 'lucide-react';

export const iconList: string[] = [
    'folder',
    'home',
    'briefcase',
    'heart',
    'key',
    'card',
    'shield',
    'star',
    'book',
    'plane',
    'cart',
    'server',
    'cloud',
    'university',
    'gamepad',
    'music'
];

export const iconComponents: Record<string, React.FC<LucideProps>> = {
    folder: Folder,
    home: Home,
    briefcase: Briefcase,
    heart: Heart,
    key: KeySquare,
    card: CreditCard,
    shield: Shield,
    star: Star,
    book: Book,
    plane: Plane,
    cart: ShoppingCart,
    server: Server,
    cloud: Cloud,
    university: University,
    gamepad: Gamepad2,
    music: Music
};
