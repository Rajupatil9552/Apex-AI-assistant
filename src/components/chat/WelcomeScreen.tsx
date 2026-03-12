import ambitLogo from '@/assets/ambit-finvest-logo.png';
import { MessageSquare, CreditCard, Truck, HelpCircle } from 'lucide-react';

type Props = {
  language: string;
  onSuggestionClick: (text: string) => void;
};

const greetings: Record<string, { greeting: string; subtitle: string; disclaimer: string }> = {
  en: {
    greeting: 'Hello! I am Pragati, your Finvest assistant.',
    subtitle: 'How can I help you today?',
    disclaimer: 'This chatbot provides information based on the Finvest website and does not offer financial or investment advice.',
  },
  hi: {
    greeting: 'नमस्ते! मैं प्रगति हूँ, आपकी Finvest सहायक।',
    subtitle: 'आज मैं आपकी कैसे मदद कर सकती हूँ?',
    disclaimer: 'यह चैटबॉट Finvest वेबसाइट पर आधारित जानकारी प्रदान करता है और वित्तीय या निवेश सलाह नहीं देता।',
  },
  mr: {
    greeting: 'नमस्कार! मी प्रगती आहे, तुमची Finvest सहाय्यक।',
    subtitle: 'आज मी तुम्हाला कशी मदत करू शकते?',
    disclaimer: 'हा चॅटबॉट Finvest वेबसाइटवर आधारित माहिती प्रदान करतो आणि आर्थिक किंवा गुंतवणूक सल्ला देत नाही.',
  },
  ta: {
    greeting: 'வணக்கம்! நான் பிரகதி, உங்கள் Finvest உதவியாளர்.',
    subtitle: 'இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?',
    disclaimer: 'இந்த சாட்போட் Finvest இணையதளத்தின் அடிப்படையில் தகவல்களை வழங்குகிறது, நிதி ஆலோசனை அல்ல.',
  },
  te: {
    greeting: 'నమస్కారం! నేను ప్రగతి, మీ Finvest సహాయకురాలిని.',
    subtitle: 'ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?',
    disclaimer: 'ఈ చాట్‌బాట్ Finvest వెబ్‌సైట్ ఆధారంగా సమాచారం అందిస్తుంది, ఆర్థిక సలహా కాదు.',
  },
  kn: {
    greeting: 'ನಮಸ್ಕಾರ! ನಾನು ಪ್ರಗತಿ, ನಿಮ್ಮ Finvest ಸಹಾಯಕಿ.',
    subtitle: 'ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    disclaimer: 'ಈ ಚಾಟ್‌ಬಾಟ್ Finvest ವೆಬ್‌ಸೈಟ್ ಆಧಾರಿತ ಮಾಹಿತಿಯನ್ನು ನೀಡುತ್ತದೆ, ಆರ್ಥಿಕ ಸಲಹೆ ಅಲ್ಲ.',
  },
  ml: {
    greeting: 'നമസ്കാരം! ഞാൻ പ്രഗതി, നിങ്ങളുടെ Finvest അസിസ്റ്റന്റ്.',
    subtitle: 'ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കും?',
    disclaimer: 'ഈ ചാറ്റ്ബോട്ട് Finvest വെബ്സൈറ്റ് അടിസ്ഥാനമാക്കിയുള്ള വിവരങ്ങൾ നൽകുന്നു, സാമ്പത്തിക ഉപദേശമല്ല.',
  },
  bn: {
    greeting: 'নমস্কার! আমি প্রগতি, আপনার Finvest সহকারী।',
    subtitle: 'আজ আমি আপনাকে কিভাবে সাহায্য করতে পারি?',
    disclaimer: 'এই চ্যাটবট Finvest ওয়েবসাইটের উপর ভিত্তি করে তথ্য প্রদান করে, আর্থিক পরামর্শ নয়।',
  },
  gu: {
    greeting: 'નમસ્તે! હું પ્રગતિ છું, તમારી Finvest સહાયક.',
    subtitle: 'આજે હું તમને કેવી રીતે મદદ કરી શકું?',
    disclaimer: 'આ ચેટબોટ Finvest વેબસાઈટ આધારિત માહિતી પ્રદાન કરે છે, નાણાકીય સલાહ નહીં.',
  },
  pa: {
    greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਪ੍ਰਗਤੀ ਹਾਂ, ਤੁਹਾਡੀ Finvest ਸਹਾਇਕ।',
    subtitle: 'ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?',
    disclaimer: 'ਇਹ ਚੈਟਬੋਟ Finvest ਵੈੱਬਸਾਈਟ ਅਧਾਰਿਤ ਜਾਣਕਾਰੀ ਦਿੰਦਾ ਹੈ, ਵਿੱਤੀ ਸਲਾਹ ਨਹੀਂ।',
  },
};

const suggestions = [
  { icon: CreditCard, text: 'What types of business loans does Ambit Finvest offer?' },
  { icon: Truck, text: 'Tell me about used vehicle loans' },
  { icon: HelpCircle, text: 'How can I check my loan eligibility?' },
  { icon: MessageSquare, text: 'What is the loan application process?' },
];

export function WelcomeScreen({ language, onSuggestionClick }: Props) {
  const lang = greetings[language] || greetings.en;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center animate-fade-in-up">
        {/* Logo */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg mb-6">
          <img src={ambitLogo} alt="Pragati" className="h-14 w-14 object-contain" />
        </div>

        {/* Greeting */}
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">{lang.greeting}</h1>
        <p className="text-lg text-muted-foreground mb-8">{lang.subtitle}</p>

        {/* Disclaimer */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 mb-8">
          <p className="text-xs text-muted-foreground">{lang.disclaimer}</p>
        </div>

        {/* Suggestions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(s.text)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all text-left text-sm text-foreground group"
            >
              <s.icon className="h-5 w-5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
