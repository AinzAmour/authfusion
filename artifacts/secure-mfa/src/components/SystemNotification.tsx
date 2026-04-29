import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ShieldAlert, Smartphone, Clock } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "otp" | "security" | "system";
  duration?: number;
}

interface NotificationContextType {
  showNotification: (notification: Omit<Notification, "id">) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((n: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { ...n, id }]);
    
    const duration = n.duration || 8000;
    setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, duration);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-[320px] w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="p-4 flex gap-4 items-start">
                  <div className="shrink-0 mt-1">
                    {n.type === "otp" && (
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-blue-400" />
                      </div>
                    )}
                    {n.type === "security" && (
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-red-400" />
                      </div>
                    )}
                    {n.type === "system" && (
                      <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {n.title || "Notification"}
                      </span>
                      <div className="flex items-center text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        now
                      </div>
                    </div>
                    <p className="text-sm font-medium text-white leading-tight">
                      {n.message}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-white/5 w-full">
                  <motion.div 
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: (n.duration || 8000) / 1000, ease: "linear" }}
                    className="h-full bg-blue-500/50"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
