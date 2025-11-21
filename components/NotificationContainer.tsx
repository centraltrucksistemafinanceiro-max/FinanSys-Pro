
import React, { useContext } from 'react';
import { WindowManagerContext, Notification as NotificationType } from '../contexts/WindowManagerContext';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const Notification: React.FC<{ notification: NotificationType; onDismiss: (id: string) => void }> = ({ notification, onDismiss }) => {
    
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(notification.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [notification.id, onDismiss]);

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <CheckCircleIcon className="w-6 h-6 text-emerald-500" />;
            case 'error': return <XCircleIcon className="w-6 h-6 text-red-500" />;
            case 'warning': return <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />;
            case 'info':
            default: return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
        }
    }

    return (
        <div className="bg-slate-100 dark:bg-slate-700 rounded-lg shadow-lg p-4 mb-4 flex items-start animate-fade-in-right">
            <div className="flex-shrink-0">{getIcon()}</div>
            <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
                <button onClick={() => onDismiss(notification.id)} className="inline-flex text-slate-400 hover:text-slate-500 dark:text-slate-300 dark:hover:text-slate-100">
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const NotificationContainer: React.FC = () => {
    const context = useContext(WindowManagerContext);

    if (!context) {
        return null;
    }

    const { notifications, removeNotification } = context;

    return (
        <div className="fixed top-5 right-5 z-[10000] w-full max-w-sm">
            {notifications.map((n) => (
                <Notification key={n.id} notification={n} onDismiss={removeNotification} />
            ))}
        </div>
    );
};

export default NotificationContainer;
