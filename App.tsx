import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderIcon, 
  ArrowPathIcon, 
  CloudArrowUpIcon, 
  CloudArrowDownIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { getHandle, saveHandle } from './services/dbService.ts';
import { 
  copyDirectory, 
  clearDirectory, 
  listBackups, 
  verifyPermission 
} from './services/fileService.ts';
import { AppState, PathType } from './types.ts';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    sourcePath: null,
    backupPath: null,
    backups: [],
    isLoading: false,
    statusMessage: 'Ready'
  });

  const [customBackupName, setCustomBackupName] = useState('');
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [apiSupported, setApiSupported] = useState(true);

  const refreshBackups = useCallback(async (bkpHandle: FileSystemDirectoryHandle) => {
    try {
      const hasPerm = await verifyPermission(bkpHandle);
      if (hasPerm) {
        const list = await listBackups(bkpHandle);
        setState(prev => ({ ...prev, backups: list }));
        if (list.length > 0) {
          setSelectedBackup(list[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to list backups", err);
    }
  }, []);

  useEffect(() => {
    setApiSupported('showDirectoryPicker' in window);

    const init = async () => {
      try {
        const src = await getHandle('sourcePath');
        const bkp = await getHandle('backupPath');
        
        setState(prev => ({
          ...prev,
          sourcePath: src,
          backupPath: bkp
        }));

        if (bkp) {
          refreshBackups(bkp);
        }
      } catch (err) {
        console.error("Initialization failed", err);
      }
    };
    init();
  }, [refreshBackups]);

  const pickDirectory = async (type: PathType) => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      
      if (type === PathType.SOURCE) {
        await saveHandle('sourcePath', handle);
        setState(prev => ({ ...prev, sourcePath: handle, statusMessage: 'Save path linked.' }));
      } else {
        await saveHandle('backupPath', handle);
        setState(prev => ({ ...prev, backupPath: handle, statusMessage: 'Vault path linked.' }));
        await refreshBackups(handle);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState(prev => ({ ...prev, statusMessage: `Error: ${err.message}` }));
    }
  };

  const handleBackup = async () => {
    if (!state.sourcePath || !state.backupPath) return;

    setState(prev => ({ ...prev, isLoading: true, statusMessage: 'Creating backup...' }));
    try {
      const hasSourcePerm = await verifyPermission(state.sourcePath);
      const hasBackupPerm = await verifyPermission(state.backupPath, true);

      if (!hasSourcePerm || !hasBackupPerm) {
        throw new Error("Permissions not granted by user.");
      }

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:T]/g, '_').split('.')[0];
      const folderName = customBackupName.trim() || `Backup_${timestamp}`;
      
      const newBackupFolder = await state.backupPath.getDirectoryHandle(folderName, { create: true });
      await copyDirectory(state.sourcePath, newBackupFolder);
      
      setState(prev => ({ ...prev, statusMessage: `Success: Backup '${folderName}' created.`, isLoading: false }));
      setCustomBackupName('');
      await refreshBackups(state.backupPath);
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, statusMessage: `Backup failed: ${err.message}` }));
    }
  };

  const handleRestore = async () => {
    if (!state.sourcePath || !state.backupPath || !selectedBackup) return;

    const confirmRestore = window.confirm(
      "RESTORE WARNING: This will PERMANENTLY DELETE all current files in your Save Path and replace them with the selected backup. Proceed?"
    );
    if (!confirmRestore) return;

    setState(prev => ({ ...prev, isLoading: true, statusMessage: 'Restoring backup...' }));
    try {
      const hasSourcePerm = await verifyPermission(state.sourcePath, true);
      const hasBackupPerm = await verifyPermission(state.backupPath);

      if (!hasSourcePerm || !hasBackupPerm) {
        throw new Error("Permissions not granted.");
      }

      const backupToRestore = state.backups.find(b => b.name === selectedBackup);
      if (!backupToRestore) throw new Error("Backup folder not found.");

      await clearDirectory(state.sourcePath);
      await copyDirectory(backupToRestore.handle, state.sourcePath);

      setState(prev => ({ ...prev, statusMessage: 'Restore completed successfully!', isLoading: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, statusMessage: `Restore failed: ${err.message}` }));
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200">
      <div className="relative max-w-5xl mx-auto px-4 py-12 md:px-8 space-y-8">
        {!apiSupported && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center text-red-400">
            <ExclamationCircleIcon className="w-6 h-6 mr-3 shrink-0" />
            <p className="text-sm">Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for file access.</p>
          </div>
        )}

        <header className="flex flex-col md:flex-row justify-between items-center gap-6 glass p-8 rounded-3xl border border-slate-700/50 shadow-2xl glow-indigo">
          <div className="flex items-center space-x-5">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl shadow-lg">
              <ShieldCheckIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">SaveVault<span className="text-indigo-400">.io</span></h1>
              <p className="text-slate-400 font-medium text-xs tracking-widest uppercase">Safe & Portable Backup Manager</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-slate-900/50 px-5 py-2.5 rounded-full border border-slate-700/50">
            <div className={`w-2.5 h-2.5 rounded-full ${state.isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              {state.isLoading ? 'Processing' : 'System Secure'}
            </span>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PathCard 
            title="Save File Path" 
            subtitle="Folder to backup/restore"
            handle={state.sourcePath} 
            onPick={() => pickDirectory(PathType.SOURCE)} 
            icon={<FolderIcon className="w-6 h-6" />}
            color="indigo"
          />
          <PathCard 
            title="Backup Vault Path" 
            subtitle="Where backups are stored"
            handle={state.backupPath} 
            onPick={() => pickDirectory(PathType.BACKUP)} 
            icon={<CloudArrowDownIcon className="w-6 h-6" />}
            color="emerald"
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 glass p-8 rounded-3xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <CloudArrowUpIcon className="w-6 h-6 mr-3 text-indigo-400" />
              New Backup
            </h2>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Optional Label (e.g. Pre-Patch 1.2)"
                value={customBackupName}
                onChange={(e) => setCustomBackupName(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 text-white"
              />
              <button
                onClick={handleBackup}
                disabled={!state.sourcePath || !state.backupPath || state.isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-5 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center"
              >
                {state.isLoading ? <ArrowPathIcon className="w-6 h-6 animate-spin mr-3" /> : <CloudArrowUpIcon className="w-6 h-6 mr-3" />}
                CREATE BACKUP
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 glass p-8 rounded-3xl flex flex-col space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <ArrowPathIcon className="w-6 h-6 mr-3 text-emerald-400" />
              Restore Point
            </h2>
            <div className="flex-1 space-y-4">
              <select 
                value={selectedBackup}
                onChange={(e) => setSelectedBackup(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500/50 outline-none text-white font-medium cursor-pointer"
              >
                {state.backups.length === 0 ? (
                  <option value="">No backups found</option>
                ) : (
                  state.backups.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))
                )}
              </select>
              <button
                onClick={handleRestore}
                disabled={!state.sourcePath || !state.backupPath || !selectedBackup || state.isLoading}
                className="w-full border-2 border-emerald-500/30 hover:bg-emerald-600 hover:border-transparent text-emerald-500 hover:text-white font-bold py-5 rounded-2xl transition-all active:scale-[0.98]"
              >
                RESTORE SELECTED
              </button>
            </div>
          </div>
        </div>

        <footer className={`flex items-center p-5 rounded-2xl border transition-all duration-300 ${
          state.statusMessage.toLowerCase().includes('failed') || state.statusMessage.toLowerCase().includes('error') ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          state.statusMessage.toLowerCase().includes('success') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          'bg-slate-800/40 border-slate-700/50 text-slate-400'
        }`}>
          <InformationCircleIcon className="w-6 h-6 mr-3 shrink-0" />
          <span className="text-xs font-bold mono uppercase tracking-tight">{state.statusMessage}</span>
        </footer>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="flex items-start space-x-3 opacity-50">
            <LockClosedIcon className="w-5 h-5 text-slate-400 mt-0.5" />
            <p className="text-[10px] leading-relaxed">Browsers require user approval for file access. Permissions are temporary and reset on refresh for security.</p>
          </div>
          <div className="flex items-start space-x-3 opacity-50 justify-end text-right">
            <p className="text-[10px] leading-relaxed">All operations happen locally. No data ever leaves your computer.</p>
            <ShieldCheckIcon className="w-5 h-5 text-slate-400 mt-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface PathCardProps {
  title: string;
  subtitle: string;
  handle: FileSystemDirectoryHandle | null;
  onPick: () => void;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald';
}

const PathCard: React.FC<PathCardProps> = ({ title, subtitle, handle, onPick, icon, color }) => {
  const hoverClass = color === 'indigo' ? 'hover:bg-indigo-600' : 'hover:bg-emerald-600';
  const accentColor = color === 'indigo' ? 'text-indigo-400' : 'text-emerald-400';

  return (
    <div className="glass p-6 rounded-3xl border border-slate-700/50 shadow-lg flex flex-col justify-between h-full group transition-all hover:border-slate-500/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl bg-slate-900 ${accentColor}`}>
            {icon}
          </div>
          {handle && <div className="text-emerald-400 text-[9px] font-black px-2 py-1 rounded bg-emerald-500/10 uppercase tracking-tighter">Connected</div>}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{subtitle}</p>
        </div>
        <div className="bg-black/40 p-3 rounded-xl border border-slate-800 truncate">
          <span className="text-[10px] font-mono text-slate-300">
            {handle ? `/${handle.name}` : 'Not linked...'}
          </span>
        </div>
      </div>
      <button 
        onClick={onPick}
        className={`mt-6 w-full py-3.5 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all border border-slate-700 ${hoverClass} hover:text-white flex items-center justify-center space-x-2`}
      >
        <span>{handle ? 'CHANGE' : 'SELECT FOLDER'}</span>
        <ArrowRightIcon className="w-3 h-3" />
      </button>
    </div>
  );
};

export default App;