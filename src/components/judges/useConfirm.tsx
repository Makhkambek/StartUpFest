'use client'
import { useState, useCallback } from 'react'

interface State {
  open: boolean
  message: string
  resolve: ((v: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<State>({ open: false, message: '', resolve: null })

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve })
    })
  }, [])

  const close = (result: boolean) => {
    state.resolve?.(result)
    setState({ open: false, message: '', resolve: null })
  }

  const modal = state.open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-100">
        <p className="text-sm text-gray-700 mb-6 leading-relaxed">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, modal }
}
