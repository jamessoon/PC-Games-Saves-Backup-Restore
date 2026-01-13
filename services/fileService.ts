

/**
 * Recursive copy function for FileSystemDirectoryHandles
 */
export const copyDirectory = async (
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle
) => {
  for await (const entry of source.values()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile();
      const newFileHandle = await target.getFileHandle(entry.name, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(file);
      await writable.close();
    } else if (entry.kind === 'directory') {
      const newDirHandle = await target.getDirectoryHandle(entry.name, { create: true });
      await copyDirectory(entry as FileSystemDirectoryHandle, newDirHandle);
    }
  }
};

/**
 * Deletes all contents of a directory without deleting the directory itself
 */
export const clearDirectory = async (handle: FileSystemDirectoryHandle) => {
  for await (const entry of handle.values()) {
    await handle.removeEntry(entry.name, { recursive: true });
  }
};

/**
 * Lists subdirectories in the backup path to find existing backups
 */
export const listBackups = async (handle: FileSystemDirectoryHandle) => {
  const backups: { name: string; handle: FileSystemDirectoryHandle; timestamp: number }[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'directory') {
      // Basic check: folders with names or custom patterns
      // We try to extract timestamp from standard naming "Backup_YYYY-MM-DD_HH-mm-ss"
      const timestampMatch = entry.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
      let timestamp = Date.now(); // fallback
      if (timestampMatch) {
          // Convert string back to timestamp for sorting
          const parts = timestampMatch[1].split(/[_-]/);
          const date = new Date(
              parseInt(parts[0]),
              parseInt(parts[1]) - 1,
              parseInt(parts[2]),
              parseInt(parts[3]),
              parseInt(parts[4]),
              parseInt(parts[5])
          );
          timestamp = date.getTime();
      }

      backups.push({
        name: entry.name,
        handle: entry as FileSystemDirectoryHandle,
        timestamp
      });
    }
  }
  return backups.sort((a, b) => b.timestamp - a.timestamp);
};

// Fix: Use 'any' type for the options and cast handle to access methods potentially missing from TS environment types
export const verifyPermission = async (handle: FileSystemHandle, readWrite: boolean = false) => {
  // Fix: Using any as FileSystemHandlePermissionDescriptor might not be defined
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  
  // Check if we already have permission, if not, request it
  // Fix: Casting handle to any to access queryPermission and requestPermission methods which may be missing in standard FileSystemHandle type
  if ((await (handle as any).queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await (handle as any).requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
};
