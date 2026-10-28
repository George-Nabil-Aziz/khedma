import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'
import { serviceYear } from './serviceYear'

const YEAR = serviceYear().label

export type Lang = 'ar' | 'en'

const dict = {
  appName: { ar: `خدمة ${YEAR}`, en: `Khedma ${YEAR}` },
  children: { ar: 'الأولاد', en: 'Children' },
  addChild: { ar: 'إضافة ولد', en: 'Add child' },
  editChild: { ar: 'تعديل بيانات', en: 'Edit child' },
  sync: { ar: 'المزامنة', en: 'Sync' },
  signIn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  signOutPending: {
    ar: 'فيه تعديلات لسه متبعتتش. لو خرجت دلوقتي هتضيع. تخرج برضه؟',
    en: 'Some changes have not been sent yet and will be lost. Sign out anyway?',
  },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  signingIn: { ar: 'جاري الدخول…', en: 'Signing in…' },
  search: { ar: 'بحث بالاسم أو الرقم…', en: 'Search by name or number…' },
  loading: { ar: 'جاري التحميل…', en: 'Loading…' },
  empty: { ar: 'لا يوجد أولاد بعد', en: 'No children yet' },
  noResults: { ar: 'لا توجد نتائج', en: 'No results' },
  total: { ar: 'العدد', en: 'Total' },
  menu: { ar: 'القائمة', en: 'Menu' },
  toggleTheme: { ar: 'تغيير المظهر', en: 'Toggle theme' },
  switchLang: { ar: 'English', en: 'العربية' },
  online: { ar: 'متصل', en: 'Online' },
  offline: { ar: 'غير متصل', en: 'Offline' },
  syncing: { ar: 'جاري المزامنة…', en: 'Syncing…' },
  // columns / fields
  name: { ar: 'الاسم', en: 'Name' },
  nameHint: { ar: 'ثلاثي على الأقل', en: 'At least three names' },
  address: { ar: 'العنوان', en: 'Address' },
  houseNumber: { ar: 'رقم المنزل', en: 'House no.' },
  street: { ar: 'اسم الشارع', en: 'Street' },
  branchOfStreet: { ar: 'متفرع من شارع', en: 'Off street' },
  landmark: { ar: 'علامة مميزة', en: 'Landmark' },
  floorLabel: { ar: 'الدور', en: 'Floor' },
  side: { ar: 'يمين / شمال / وسط', en: 'Right / Left / Middle' },
  apartmentLabel: { ar: 'رقم الشقة', en: 'Apartment' },
  birthDate: { ar: 'تاريخ الميلاد', en: 'Birth date' },
  phones: { ar: 'التليفونات', en: 'Phones' },
  motherMobile: { ar: 'موبايل ماما', en: "Mother's mobile" },
  fatherMobile: { ar: 'موبايل بابا', en: "Father's mobile" },
  childMobile: { ar: 'موبايل الولد', en: "Child's mobile" },
  deacon: { ar: 'شماس', en: 'Deacon' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  nationalId: { ar: 'الرقم القومي', en: 'National ID' },
  basicInfo: { ar: 'البيانات الأساسية', en: 'Basic info' },
  right: { ar: 'يمين', en: 'Right' },
  left: { ar: 'شمال', en: 'Left' },
  middle: { ar: 'وسط', en: 'Middle' },
  // address parts in the list
  house: { ar: 'منزل', en: 'No.' },
  branchOf: { ar: 'متفرع من', en: 'off' },
  floor: { ar: 'الدور', en: 'Floor' },
  apartment: { ar: 'شقة', en: 'Apt' },
  // form
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  required: { ar: 'مطلوب', en: 'Required' },
  invalidNationalId: { ar: 'الرقم القومي 14 رقم', en: 'National ID must be 14 digits' },
  invalidPhone: { ar: 'رقم غير صحيح', en: 'Invalid number' },
  savedOffline: { ar: 'اتحفظ على الجهاز، وهيتبعت لما النت يرجع', en: 'Saved on this device — it will be sent when you are back online' },
  notFound: { ar: 'الولد ده مش موجود', en: 'Child not found' },
  inConflict: { ar: 'فيه تعارض على الولد ده. حلّه من صفحة المزامنة الأول.', en: 'This child has a conflict. Resolve it on the Sync page first.' },
  // statuses
  statusPending: { ar: 'لم يُرسل بعد', en: 'Not sent yet' },
  statusConflict: { ar: 'تعارض', en: 'Conflict' },
  statusError: { ar: 'خطأ', en: 'Error' },
  // sync page
  syncNow: { ar: 'زامن الآن', en: 'Sync now' },
  lastSync: { ar: 'آخر مزامنة', en: 'Last sync' },
  never: { ar: 'لم تتم بعد', en: 'Never' },
  pendingChanges: { ar: 'تعديلات مستنية تتبعت', en: 'Waiting to be sent' },
  noPending: { ar: 'كل حاجة متبعتة ✓', en: 'Everything is sent ✓' },
  conflicts: { ar: 'تعارضات', en: 'Conflicts' },
  noConflicts: { ar: 'مفيش تعارضات ✓', en: 'No conflicts ✓' },
  conflictHelp: {
    ar: 'حد تاني عدّل نفس البيانات قبلك. اختار أنهي نسخة تفضل.',
    en: 'Someone else changed the same data first. Choose which version to keep.',
  },
  deletedOnServer: { ar: 'الولد ده اتمسح من الداتابيز', en: 'This child was deleted on the server' },
  field: { ar: 'الحقل', en: 'Field' },
  mine: { ar: 'تعديلي', en: 'Mine' },
  theirs: { ar: 'اللي على السيرفر', en: 'On server' },
  keepMine: { ar: 'خلي تعديلي', en: 'Keep mine' },
  keepTheirs: { ar: 'خلي اللي على السيرفر', en: 'Keep server' },
  retry: { ar: 'حاول تاني', en: 'Retry' },
  discard: { ar: 'تجاهل', en: 'Discard' },
  edit: { ar: 'تعديل', en: 'Edit' },
  newChild: { ar: 'ولد جديد', en: 'New child' },
  changed: { ar: 'تعديل', en: 'Edit' },
  syncFailed: { ar: 'المزامنة فشلت', en: 'Sync failed' },
  offlineNote: {
    ar: 'إنت offline. أي إضافة أو تعديل هيتحفظ على الجهاز ويتبعت لوحده لما النت يرجع.',
    en: 'You are offline. Anything you add or edit is saved on this device and sent automatically when you reconnect.',
  },
  // columns menu & sorting
  columns: { ar: 'الأعمدة', en: 'Columns' },
  showHideColumns: { ar: 'إظهار / إخفاء الأعمدة', en: 'Show / hide columns' },
  alwaysShown: { ar: 'ثابت دايماً', en: 'Always shown' },
  resetDefault: { ar: 'الافتراضي', en: 'Default' },
  moveUp: { ar: 'لفوق', en: 'Move up' },
  moveDown: { ar: 'لتحت', en: 'Move down' },
  close: { ar: 'إغلاق', en: 'Close' },
  sortBy: { ar: 'ترتيب حسب', en: 'Sort by' },
  age: { ar: 'السن', en: 'Age' },
  // phones & contact
  mother: { ar: 'ماما', en: 'Mother' },
  father: { ar: 'بابا', en: 'Father' },
  childOwner: { ar: 'الولد', en: 'Child' },
  addNumber: { ar: 'إضافة رقم', en: 'Add number' },
  removeNumber: { ar: 'حذف الرقم', en: 'Remove number' },
  hasWhatsapp: { ar: 'عليه واتساب', en: 'Has WhatsApp' },
  primaryContact: { ar: 'التواصل الأساسي', en: 'Main contact' },
  makePrimary: { ar: 'اجعله التواصل الأساسي', en: 'Make main contact' },
  // custom fields
  customize: { ar: 'تعديل الأعمدة', en: 'Edit columns' },
  extraFields: { ar: 'حقول إضافية', en: 'Extra fields' },
  customFieldsHelp: {
    ar: 'أي عمود تضيفه هنا هيظهر في جدول الأولاد وفي صفحة التعديل، ولكل الخدام.',
    en: 'Columns added here appear in the children table and the edit form, for every servant.',
  },
  addField: { ar: 'إضافة عمود', en: 'Add column' },
  fieldLabel: { ar: 'اسم العمود', en: 'Column name' },
  fieldType: { ar: 'النوع', en: 'Type' },
  typeText: { ar: 'نص', en: 'Text' },
  typeNumber: { ar: 'رقم', en: 'Number' },
  typeDate: { ar: 'تاريخ', en: 'Date' },
  typeBoolean: { ar: 'نعم / لا', en: 'Yes / No' },
  yes: { ar: 'نعم', en: 'Yes' },
  no: { ar: 'لا', en: 'No' },
  noCustomFields: { ar: 'لسه مفيش أعمدة إضافية', en: 'No extra columns yet' },
  deleteField: { ar: 'حذف العمود', en: 'Delete column' },
  deleteFieldConfirm: {
    ar: 'هيختفي العمود ده من عند كل الخدام. البيانات اللي اتكتبت فيه هتفضل محفوظة بس مش هتظهر. متأكد؟',
    en: 'This column disappears for every servant. Values already typed are kept but hidden. Are you sure?',
  },
  onlineOnly: { ar: 'تعديل الأعمدة محتاج نت', en: 'Editing columns needs a connection' },
  builtInColumns: { ar: 'الأعمدة الأساسية', en: 'Built-in columns' },
  builtInHelp: {
    ar: 'دي ثابتة في الداتابيز. تقدر تخفيها أو ترتّبها من زرار "الأعمدة" في صفحة الأولاد.',
    en: 'These are fixed in the database. Hide or reorder them from the "Columns" button on the Children page.',
  },
  // الافتقاد
  attendance: { ar: 'الافتقاد', en: 'Follow-up' },
  attendanceTotal: { ar: 'عدد العلامات', en: 'Ticks' },
  attendanceOrderNote: { ar: 'نفس ترتيب صفحة الأولاد', en: 'Same order as the Children page' },
  attPending: { ar: 'علامات افتقاد مستنية تتبعت', en: 'Follow-up ticks waiting to be sent' },
  refresh: { ar: 'تحديث', en: 'Refresh' },
  // audit
  audit: { ar: 'سجل التعديلات', en: 'Audit log' },
  auditAll: { ar: 'الكل', en: 'All' },
  auditLogins: { ar: 'الدخول والخروج', en: 'Sign-ins' },
  auditLogin: { ar: 'دخول', en: 'Signed in' },
  auditLogout: { ar: 'خروج', en: 'Signed out' },
  auditAdded: { ar: 'إضافة', en: 'Added' },
  auditEdited: { ar: 'تعديل', en: 'Edited' },
  auditDeleted: { ar: 'حذف', en: 'Deleted' },
  auditTicked: { ar: 'علامة ✓', en: 'Ticked' },
  auditUnticked: { ar: 'شيل العلامة', en: 'Unticked' },
  auditDashboard: { ar: 'من لوحة Supabase', en: 'Supabase dashboard' },
  auditOnlineOnly: { ar: 'السجل محتاج نت علشان يظهر', en: 'The audit log needs a connection' },
  auditEmpty: { ar: 'لسه مفيش حاجة في السجل', en: 'Nothing logged yet' },
  loadMore: { ar: 'عرض أكتر', en: 'Load more' },
  admin: { ar: 'أدمن', en: 'Admin' },
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

  return <I18nContext.Provider value={{ lang, setLang, t: k => dict[k][lang] }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
