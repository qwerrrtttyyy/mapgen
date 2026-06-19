import { useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export default function Toast() {
  const { toast, setToast } = useMapStore();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, setToast]);

  if (!toast) return null;

  const icon = toast.type === 'success' ? <CheckCircle size={16} className="text-green-400" /> :
               toast.type === 'error' ? <XCircle size={16} className="text-red-400" /> :
               <Info size={16} className="text-blue-400" />;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/90 border border-white/10 shadow-lg backdrop-blur-sm">
        {icon}
        <span className="text-sm text-white/90">{toast.message}</span>
      </div>
    </div>
  );
}
