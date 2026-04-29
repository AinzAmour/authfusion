import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          welcome: 'Welcome to AuthFusion',
          scan_qr: 'Scan to verify',
          face_instructions: 'Follow the instructions below',
        },
      },
      hi: {
        translation: {
          welcome: 'AuthFusion में आपका स्वागत है',
          scan_qr: 'सत्यापित करने के लिए स्कैन करें',
          face_instructions: 'नीचे दिए गए निर्देशों का पालन करें',
        },
      },
    },
  })

export default i18n
