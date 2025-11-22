import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseInputRestrictionsOptions {
  onViolation?: (violationType: string, details: string) => void;
  onCriticalViolation?: (violationType: string, details: string) => void;
  enabled?: boolean;
  warningsBeforeAutoSubmit?: number;
}

interface ViolationWarning {
  type: string;
  count: number;
  maxWarnings: number;
  lastWarningTime: number;
}

export function useInputRestrictions(options: UseInputRestrictionsOptions = {}) {
  const {
    onViolation,
    onCriticalViolation,
    enabled = true,
    warningsBeforeAutoSubmit = 2,
  } = options;

  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [currentViolationType, setCurrentViolationType] = useState<string>('');
  
  // Track warnings for different violation types
  const warningsRef = useRef<Map<string, ViolationWarning>>(new Map());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showViolationWarning = useCallback((violationType: string, message: string) => {
    const now = Date.now();
    const warnings = warningsRef.current;
    const currentWarning = warnings.get(violationType) || {
      type: violationType,
      count: 0,
      maxWarnings: warningsBeforeAutoSubmit,
      lastWarningTime: 0,
    };

    // Prevent spam warnings (minimum 2 seconds between same violation type)
    if (now - currentWarning.lastWarningTime < 2000) {
      return;
    }

    currentWarning.count++;
    currentWarning.lastWarningTime = now;
    warnings.set(violationType, currentWarning);

    const remainingWarnings = Math.max(0, currentWarning.maxWarnings - currentWarning.count);

    if (currentWarning.count >= currentWarning.maxWarnings) {
      // Final warning - this will trigger auto-submit
      setCurrentViolationType(violationType);
      setShowWarningDialog(true);
      
      toast.error('🚨 FINAL WARNING', {
        description: `${message}. Your exam will be auto-submitted if you continue this behavior.`,
        duration: 8000,
      });

      // Auto-dismiss warning and trigger critical violation after 10 seconds
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarningDialog(false);
        onCriticalViolation?.(violationType, `Final warning exceeded: ${message}`);
      }, 10000);
    } else {
      // Regular warning
      toast.warning('⚠️ Security Warning', {
        description: `${message}. ${remainingWarnings} more warnings before exam termination.`,
        duration: 5000,
      });
      
      onViolation?.(violationType, message);
    }
  }, [warningsBeforeAutoSubmit, onViolation, onCriticalViolation]);

  const dismissWarning = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    setShowWarningDialog(false);
    setCurrentViolationType('');
  }, []);

  const proceedWithViolation = useCallback(() => {
    const violationType = currentViolationType;
    dismissWarning();
    
    // Trigger immediate critical violation
    setTimeout(() => {
      onCriticalViolation?.(violationType, `User proceeded despite final warning: ${violationType}`);
    }, 100);
  }, [currentViolationType, dismissWarning, onCriticalViolation]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, key, code } = event;
      const isModifierPressed = ctrlKey || metaKey;

      // Detect copy/paste attempts
      if (isModifierPressed) {
        switch (key.toLowerCase()) {
          case 'c':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'copy_attempt',
              'Copy operation detected and blocked'
            );
            return false;

          case 'v':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'paste_attempt',
              'Paste operation detected and blocked'
            );
            return false;

          case 'x':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'cut_attempt',
              'Cut operation detected and blocked'
            );
            return false;

          case 'a':
            // Allow select all for text inputs only
            const target = event.target as HTMLElement;
            if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
              event.preventDefault();
              event.stopPropagation();
              showViolationWarning(
                'select_all_attempt',
                'Select All operation detected and blocked'
              );
              return false;
            }
            break;

          case 'z':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'undo_attempt',
              'Undo operation detected and blocked'
            );
            return false;

          case 'y':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'redo_attempt',
              'Redo operation detected and blocked'
            );
            return false;

          case 'r':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'refresh_attempt',
              'Page refresh attempt detected and blocked'
            );
            return false;

          case 'w':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'close_tab_attempt',
              'Tab close attempt detected and blocked'
            );
            return false;

          case 't':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'new_tab_attempt',
              'New tab attempt detected and blocked'
            );
            return false;

          case 'n':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'new_window_attempt',
              'New window attempt detected and blocked'
            );
            return false;

          case 's':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'save_attempt',
              'Save attempt detected and blocked'
            );
            return false;

          case 'p':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'print_attempt',
              'Print attempt detected and blocked'
            );
            return false;

          case 'u':
            event.preventDefault();
            event.stopPropagation();
            showViolationWarning(
              'view_source_attempt',
              'View source attempt detected and blocked'
            );
            return false;

          case 'i':
            if (event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              showViolationWarning(
                'dev_tools_attempt',
                'Developer tools access attempt detected and blocked'
              );
              return false;
            }
            break;

          case 'j':
            if (event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              showViolationWarning(
                'dev_tools_attempt',
                'Developer tools access attempt detected and blocked'
              );
              return false;
            }
            break;
        }
      }

      // Function keys restrictions
      if (key.startsWith('F') && key.length <= 3) {
        const fNumber = parseInt(key.substring(1));
        if (fNumber >= 1 && fNumber <= 12) {
          event.preventDefault();
          event.stopPropagation();
          
          let violationType = 'function_key_attempt';
          let message = `Function key ${key} detected and blocked`;
          
          // Special handling for F12 (dev tools)
          if (fNumber === 12) {
            violationType = 'dev_tools_attempt';
            message = 'Developer tools access attempt detected and blocked';
          }
          
          showViolationWarning(violationType, message);
          return false;
        }
      }

      // Alt+Tab detection
      if (event.altKey && key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        showViolationWarning(
          'alt_tab_attempt',
          'Alt+Tab window switching detected and blocked'
        );
        return false;
      }

      // Windows key detection
      if (key === 'Meta' || code === 'MetaLeft' || code === 'MetaRight') {
        event.preventDefault();
        event.stopPropagation();
        showViolationWarning(
          'windows_key_attempt',
          'Windows key usage detected and blocked'
        );
        return false;
      }

      // ESC key handling
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        showViolationWarning(
          'escape_attempt',
          'Escape key usage detected and blocked'
        );
        return false;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Additional key up monitoring if needed
      if (event.key === 'Meta' || event.code === 'MetaLeft' || event.code === 'MetaRight') {
        event.preventDefault();
        return false;
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showViolationWarning(
        'context_menu_attempt',
        'Right-click context menu detected and blocked'
      );
      return false;
    };

    const handleSelectStart = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        event.preventDefault();
        showViolationWarning(
          'text_selection_attempt',
          'Text selection attempt detected and blocked'
        );
        return false;
      }
    };

    const handleDragStart = (event: DragEvent) => {
      event.preventDefault();
      showViolationWarning(
        'drag_attempt',
        'Drag operation detected and blocked'
      );
      return false;
    };

    // Add event listeners with high priority
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    document.addEventListener('keyup', handleKeyUp, { capture: true, passive: false });
    document.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });
    document.addEventListener('selectstart', handleSelectStart, { capture: true, passive: false });
    document.addEventListener('dragstart', handleDragStart, { capture: true, passive: false });

    // Disable drag and drop
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      showViolationWarning(
        'drop_attempt',
        'Drop operation detected and blocked'
      );
    }, { capture: true, passive: false });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    }, { capture: true, passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('selectstart', handleSelectStart, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, [enabled, showViolationWarning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  return {
    showWarningDialog,
    currentViolationType,
    dismissWarning,
    proceedWithViolation,
    warningCounts: Object.fromEntries(warningsRef.current),
  };
}