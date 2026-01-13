
export interface BackupInfo {
  name: string;
  timestamp: number;
  handle: FileSystemDirectoryHandle;
}

export interface AppState {
  sourcePath: FileSystemDirectoryHandle | null;
  backupPath: FileSystemDirectoryHandle | null;
  backups: BackupInfo[];
  isLoading: boolean;
  statusMessage: string;
}

export enum PathType {
  SOURCE = 'SOURCE',
  BACKUP = 'BACKUP'
}
