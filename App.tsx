
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderIcon, 
  ArrowPathIcon, 
  CloudArrowUpIcon, 
  CloudArrowDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { getHandle, saveHandle } from './services/dbService';
import { 
  copyDirectory, 
  clearDirectory, 
  listBackups, 
  verifyPermission 
} from './services/fileService';
import { AppState, PathType } from './types';

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

  // Initialize and load saved directory handles
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
  }, []);

  const refreshBackups = useCallback(async (bkpHandle: FileSystemDirectoryHandle) => {
    try {
      const hasPerm = await verifyPermission(bkpHandle);
      if (hasPerm) {
        const list = await listBackups(bkpHandle);
        setState(prev => ({ ...prev, backups: list }));
        if (list.length > 0 && !selectedBackup) {
          setSelectedBackup(list[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to list backups", err);
    }
  }, [selectedBackup]);

  const pickDirectory = async (type: PathType) => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      
      if (type === PathType.SOURCE) {
        await saveHandle('sourcePath', handle);
        setState(prev => ({ ...prev, sourcePath: handle, statusMessage: 'Source path updated.' }));
      } else {
        await saveHandle('backupPath', handle);
        setState(prev => ({ ...prev, backupPath: handle, statusMessage: 'Backup path updated.' }));
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
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 selection:bg-indigo-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 md:px-8 space-y-8">
        
        {/* API Check */}
        {!apiSupported && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center text-red-400">
            <ExclamationCircleIcon className="w-6 h-6 mr-3 shrink-0" />
            <p className="text-sm">Your browser doesn't support the File System API. Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.</p>
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
          <div className="flex items-center space-x-5">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl shadow-lg shadow-indigo-500/20">
              <ShieldCheckIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">SaveVault</h1>
              <p className="text-slate-400 font-medium">Professional Client-Side Backup Utility</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-slate-900/50 px-5 py-2.5 rounded-full border border-slate-700/50">
            <div className={`w-2.5 h-2.5 rounded-full ${state.isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
              {state.isLoading ? 'Operation in Progress' : 'System Secure'}
            </span>
          </div>
        </header>

        {/* Path Configuration */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PathCard 
            title="Save File Path" 
            subtitle="The folder where your active files live"
            handle={state.sourcePath} 
            onPick={() => pickDirectory(PathType.SOURCE)} 
            icon={<FolderIcon className="w-6 h-6" />}
            color="indigo"
          />
          <PathCard 
            title="Backup Vault Path" 
            subtitle="The destination for your historical backups"
            handle={state.backupPath} 
            onPick={() => pickDirectory(PathType.BACKUP)} 
            icon={<CloudArrowDownIcon className="w-6 h-6" />}
            color="emerald"
          />
        </section>

        {/* Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Create Backup */}
          <div className="lg:col-span-3 bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center">
                <CloudArrowUpIcon className="w-6 h-6 mr-3 text-indigo-400" />
                Snapshot Manager
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 ml-1">Optional Snapshot Label</label>
                <input 
                  type="text" 
                  placeholder="e.g. Save Before Modding"
                  value={customBackupName}
                  onChange={(e) => setCustomBackupName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all placeholder:text-slate-600 text-white"
                />
              </div>

              <button
                onClick={handleBackup}
                disabled={!state.sourcePath || !state.backupPath || state.isLoading}
                className="group relative w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/10 active:scale-[0.98] overflow-hidden"
              >
                <div className="relative z-10 flex items-center justify-center">
                  {state.isLoading ? (
                    <ArrowPathIcon className="w-6 h-6 animate-spin mr-3" />
                  ) : (
                    <CloudArrowUpIcon className="w-6 h-6 mr-3" />
                  )}
                  CREATE NEW BACKUP
                </div>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>
          </div>

          {/* Restore Backup */}
          <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <ArrowPathIcon className="w-6 h-6 mr-3 text-emerald-400" />
              Restore Point
            </h2>
            
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 ml-1">Available Backups</label>
                <div className="relative">
                  <select 
                    value={selectedBackup}
                    onChange={(e) => setSelectedBackup(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none appearance-none text-white font-medium cursor-pointer"
                  >
                    {state.backups.length === 0 ? (
                      <option value="">No backups found in vault</option>
                    ) : (
                      state.backups.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ArrowPathIcon className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleRestore}
                disabled={!state.sourcePath || !state.backupPath || !selectedBackup || state.isLoading}
                className="group w-full bg-slate-700/50 hover:bg-emerald-600/90 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-emerald-400 hover:text-white font-bold py-5 rounded-2xl transition-all border border-emerald-500/20 hover:border-transparent active:scale-[0.98]"
              >
                RESTORE SELECTED
              </button>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`flex items-center p-5 rounded-2xl border transition-all duration-300 ${
          state.statusMessage.toLowerCase().includes('failed') || state.statusMessage.toLowerCase().includes('error') ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          state.statusMessage.toLowerCase().includes('success') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          'bg-slate-800/40 border-slate-700/50 text-slate-400'
        }`}>
          {state.statusMessage.toLowerCase().includes('failed') ? (
            <ExclamationCircleIcon className="w-6 h-6 mr-3 shrink-0" />
          ) : state.statusMessage.toLowerCase().includes('success') ? (
            <CheckCircleIcon className="w-6 h-6 mr-3 shrink-0" />
          ) : (
            <InformationCircleIcon className="w-6 h-6 mr-3 shrink-0" />
          )}
          <span className="text-sm font-semibold">{state.statusMessage}</span>
        </div>

        {/* Security Info */}
        <footer className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          <div className="bg-slate-800/20 p-6 rounded-2xl border border-slate-800/50 space-y-3">
            <LockClosedIcon className="w-6 h-6 text-indigo-400" />
            <h4 className="text-white font-bold text-sm">Sandboxed Security</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Browsers only allow access to folders you explicitly select. We cannot see your files unless you grant permission.</p>
          </div>
          <div className="bg-slate-800/20 p-6 rounded-2xl border border-slate-800/50 space-y-3">
            <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
            <h4 className="text-white font-bold text-sm">Local Processing</h4>
            <p className="text-xs text-slate-500 leading-relaxed">All file copying happens directly on your machine. Your data is never uploaded or sent to any server.</p>
          </div>
          <div className="bg-slate-800/20 p-6 rounded-2xl border border-slate-800/50 space-y-3">
            <ArrowRightIcon className="w-6 h-6 text-slate-400" />
            <h4 className="text-white font-bold text-sm">Re-Authorization</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Browsers revoke file access when you close the tab. You will be prompted to re-grant permission when you return.</p>
          </div>
        </footer>

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
  const colorClass = color === 'indigo' ? 'text-indigo-400 bg-indigo-500/10' : 'text-emerald-400 bg-emerald-500/10';
  const borderClass = color === 'indigo' ? 'border-indigo-500/20' : 'border-emerald-500/20';
  const hoverClass = color === 'indigo' ? 'hover:bg-indigo-500 text-white' : 'hover:bg-emerald-600 text-white';

  return (
    <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-lg flex flex-col justify-between h-full group transition-all hover:border-slate-600">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${colorClass}`}>
            {icon}
          </div>
          {handle && (
            <div className="flex items-center bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">
              Linked
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        </div>
        <div className={`bg-slate-900/80 p-4 rounded-2xl border ${borderClass} truncate`}>
          <span className={`text-xs font-mono ${handle ? 'text-slate-200' : 'text-slate-600 italic'}`}>
            {handle ? `/${handle.name}` : 'Not configured'}
          </span>
        </div>
      </div>
      
      <button 
        onClick={onPick}
        className={`mt-6 w-full py-3.5 rounded-xl text-xs font-bold transition-all border border-slate-700 ${hoverClass} flex items-center justify-center space-x-2`}
      >
        <span>{handle ? 'CHANGE FOLDER' : 'SELECT FOLDER'}</span>
        <ArrowRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default App;
