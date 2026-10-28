import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'

export type Lang = 'ar' | 'en'

const dict = {
  appName: { ar: 'خدمة 2027', en: 'Khedma 2027' },
  children: { ar: 'الأولاد', en: 'Children' },
  signIn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  signingIn: { ar: 'جاري الدخول…', en: 'Signing in…' },
  search: { ar: 'بحث بالاسم أو الرقم…', en: 'Search by name or number…' },
  loading: { ar: 'جاري التحميل…', en: 'Loading…' },
  empty: { ar: 'لا يوجد أولاد بعد', en: 'No children yet' },
  noResults: { ar: 'لا توجد نتائج', en: 'No results' },
  total: { ar: 'العدد', en: 'Total' },
  refresh: { ar: 'تحديث', en: 'Refresh' },
  menu: { ar: 'القائمة', en: 'Menu' },
  toggleTheme: { ar: 'تغيير المظهر', en: 'Toggle theme' },
  // columns
  name: { ar: 'الاسم', en: 'Name' },
  address: { ar: 'العنوان', en: 'Address' },
  landmark: { ar: 'علامة مميزة', en: 'Landmark' },
  birthDate: { ar: 'تاريخ الميلاد', en: 'Birth date' },
  motherMobile: { ar: 'موبايل ماما', en: "Mother's mobile" },
  fatherMobile: { ar: 'موبايل بابا', en: "Father's mobile" },
  childMobile: { ar: 'موبايل الولد', en: "Child's mobile" },
  deacon: { ar: 'شماس', en: 'Deacon' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  nationalId: { ar: 'الرقم القومي', en: 'National ID' },
  // address parts
  house: { ar: 'منزل', en: 'No.' },
  branchOf: { ar: 'متفرع من', en: 'off' },
  floor: { ar: 'الدور', en: 'Floor' },
  apartment: { ar: 'شقة', en: 'Apt' },
} satisfies Record<string, Record<Lang, string>>

export type TKey = keyof typeof dict

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (load('lang') === 'en' ? 'en' : 'ar'))

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = dict.appName[lang]
    save('lang', lang)
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t: k => dict[k][lang] }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
