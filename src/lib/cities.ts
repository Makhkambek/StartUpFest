// 14 regional capitals / major cities of Uzbekistan where SFRC competitions run.
// `code` is the 3-letter slug stored in event_settings.city_code.
// Names per locale are used by useEventSettings consumers (UI labels, trophy card watermark).

export interface UzCity {
  code: string
  en: string
  ru: string
  uz: string
}

export const UZ_CITIES: readonly UzCity[] = [
  { code: 'TSH', en: 'Tashkent',  ru: 'Ташкент',   uz: 'Toshkent'  },
  { code: 'SAM', en: 'Samarkand', ru: 'Самарканд', uz: 'Samarqand' },
  { code: 'BUX', en: 'Bukhara',   ru: 'Бухара',    uz: 'Buxoro'    },
  { code: 'AND', en: 'Andijan',   ru: 'Андижан',   uz: 'Andijon'   },
  { code: 'NAM', en: 'Namangan',  ru: 'Наманган',  uz: 'Namangan'  },
  { code: 'FAR', en: 'Fergana',   ru: 'Фергана',   uz: 'Fargʻona'  },
  { code: 'QAR', en: 'Qarshi',    ru: 'Карши',     uz: 'Qarshi'    },
  { code: 'TER', en: 'Termez',    ru: 'Термез',    uz: 'Termiz'    },
  { code: 'NUK', en: 'Nukus',     ru: 'Нукус',     uz: 'Nukus'     },
  { code: 'URG', en: 'Urgench',   ru: 'Ургенч',    uz: 'Urganch'   },
  { code: 'NAV', en: 'Navoiy',    ru: 'Навои',     uz: 'Navoiy'    },
  { code: 'JIZ', en: 'Jizzakh',   ru: 'Джизак',    uz: 'Jizzax'    },
  { code: 'GUL', en: 'Gulistan',  ru: 'Гулистан',  uz: 'Guliston'  },
  { code: 'XOR', en: 'Khiva',     ru: 'Хива',      uz: 'Xiva'      },
] as const

export const DEFAULT_CITY_CODE = 'TSH'

export function findCity(code: string | null | undefined): UzCity {
  const found = UZ_CITIES.find((c) => c.code === code)
  if (!found && code) {
    console.warn(`[cities] unknown city code: ${code} — falling back to ${UZ_CITIES[0].code}`)
  }
  return found ?? UZ_CITIES[0]
}

// Pick the locale-appropriate display name. Falls back to English.
export function cityLabel(city: UzCity, locale: 'en' | 'ru' | 'uz'): string {
  return city[locale] ?? city.en
}
