import { useState, type InputHTMLAttributes } from 'react'
import { useI18n } from '../lib/i18n'
import { EyeIcon, EyeOffIcon } from './Icons'

/** A password box with an eye button that shows / hides what was typed. */
export function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useI18n()
  const [shown, setShown] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={`${className} pe-10`} />
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        disabled={props.disabled}
        title={shown ? t('hidePassword') : t('showPassword')}
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        aria-pressed={shown}
        className="absolute inset-y-0 inset-e-0 grid w-10 place-items-center text-slate-400 hover:text-slate-700 disabled:opacity-40 dark:hover:text-slate-200"
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
