import { create } from 'zustand'

// Promise-based confirm/prompt that work in both the browser and the Tauri
// webview. Native window.confirm()/prompt() are not reliably wired in WKWebView
// (they return false / null), which silently cancels destructive actions and
// text entry like deleting a project or naming a template. The <ConfirmHost/>
// component renders the actual modal from this store.

export type ConfirmReq = {
  kind: 'confirm' | 'prompt'
  message: string
  confirmLabel: string
  danger: boolean
  defaultValue: string
  resolve: (value: boolean | string | null) => void
}

type Store = {
  req: ConfirmReq | null
  open: (req: ConfirmReq) => void
  close: () => void
}

export const useConfirmStore = create<Store>(set => ({
  req: null,
  open: req => set({ req }),
  close: () => set({ req: null }),
}))

export function confirmDialog(
  message: string,
  opts?: { confirmLabel?: string; danger?: boolean },
): Promise<boolean> {
  return new Promise(resolve => {
    useConfirmStore.getState().open({
      kind: 'confirm',
      message,
      confirmLabel: opts?.confirmLabel ?? 'Confirm',
      danger: opts?.danger ?? false,
      defaultValue: '',
      resolve: v => resolve(v === true),
    })
  })
}

export function promptDialog(
  message: string,
  opts?: { defaultValue?: string; confirmLabel?: string },
): Promise<string | null> {
  return new Promise(resolve => {
    useConfirmStore.getState().open({
      kind: 'prompt',
      message,
      confirmLabel: opts?.confirmLabel ?? 'Save',
      danger: false,
      defaultValue: opts?.defaultValue ?? '',
      resolve: v => resolve(typeof v === 'string' ? v : null),
    })
  })
}
