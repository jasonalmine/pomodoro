import { useState } from 'react'
import { Button } from './Button'
import { useConfirmStore, type ConfirmReq } from '../lib/confirm'

// Renders the confirm/prompt modal driven by the confirm store. Mounted once at
// the app root. The confirmDialog()/promptDialog() helpers live in lib/confirm.
export function ConfirmHost() {
  const req = useConfirmStore(s => s.req)
  const close = useConfirmStore(s => s.close)
  if (!req) return null
  return <Dialog key={req.message + req.kind} req={req} close={close} />
}

function Dialog({ req, close }: { req: ConfirmReq; close: () => void }) {
  const [value, setValue] = useState(req.defaultValue)
  const cancel = () => { req.resolve(req.kind === 'prompt' ? null : false); close() }
  const accept = () => { req.resolve(req.kind === 'prompt' ? value : true); close() }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={cancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm text-ink-800 dark:text-ink-100 whitespace-pre-line">{req.message}</p>
        {req.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') accept(); if (e.key === 'Escape') cancel() }}
            className="mt-3 w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button
            variant={req.danger ? 'danger' : 'primary'}
            onClick={accept}
            disabled={req.kind === 'prompt' && !value.trim()}
            autoFocus={req.kind === 'confirm'}
          >
            {req.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
