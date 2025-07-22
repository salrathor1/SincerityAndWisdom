// Arabic to English translation dictionary
export const arabicDictionary: Record<string, string> = {
  // Common Islamic terms
  "الله": "Allah (God)",
  "الإسلام": "Islam",
  "المسلمين": "Muslims",
  "المسلم": "Muslim",
  "القرآن": "Quran",
  "السُنة": "Sunnah",
  "الحديث": "Hadith",
  "النبي": "The Prophet",
  "الرسول": "The Messenger",
  "محمد": "Muhammad",
  "صلى": "may Allah's peace and blessings be upon",
  "عليه": "him",
  "وسلم": "and grant him peace",
  "الصلاة": "Prayer/Salah",
  "الزكاة": "Zakat (obligatory charity)",
  "الصوم": "Fasting",
  "الحج": "Hajj (pilgrimage)",
  "الإيمان": "Faith/Iman",
  "التوحيد": "Tawhid (monotheism)",
  "الشرك": "Shirk (polytheism)",
  "الجنة": "Paradise",
  "النار": "Hell",
  "الآخرة": "The Hereafter",
  "الدنيا": "This world",
  "يوم": "Day",
  "القيامة": "The Day of Judgment",
  
  // Common Arabic words
  "في": "in",
  "مِن": "from/of",
  "إلى": "to",
  "على": "on/upon",
  "هذا": "this (masculine)",
  "هذه": "this (feminine)",
  "ذلك": "that (masculine)",
  "تلك": "that (feminine)",
  "كل": "all/every",
  "بعض": "some",
  "مع": "with",
  "عند": "at/with",
  "بين": "between",
  "عن": "about/from",
  "أن": "that/to",
  "لا": "no/not",
  "نعم": "yes",
  "كيف": "how",
  "ماذا": "what",
  "متى": "when",
  "أين": "where",
  "لماذا": "why",
  "مَن": "who",
  "الناس": "people",
  "الرجل": "man",
  "المرأة": "woman",
  "الولد": "boy",
  "البنت": "girl",
  "الأب": "father",
  "الأم": "mother",
  "الأخ": "brother",
  "الأخت": "sister",
  "البيت": "house",
  "المسجد": "mosque",
  "المدرسة": "school",
  "الكتاب": "book",
  "العلم": "knowledge",
  "التعلم": "learning",
  "المعلم": "teacher",
  "الطالب": "student",
  "الحق": "truth/right",
  "الباطل": "falsehood",
  "الخير": "good",
  "الشر": "evil",
  "الحب": "love",
  "الخوف": "fear",
  "الأمل": "hope",
  "السلام": "peace",
  "الحرب": "war",
  "العدل": "justice",
  "الظلم": "injustice/oppression",
  "الصبر": "patience",
  "الشكر": "gratitude",
  "التوبة": "repentance",
  "المغفرة": "forgiveness",
  "الرحمة": "mercy",
  "العذاب": "punishment",
  "الثواب": "reward",
  "العمل": "work/deed",
  "الصالح": "righteous",
  "السيئ": "bad",
  "الحسن": "good",
  "الجميل": "beautiful",
  "القبيح": "ugly",
  "الكبير": "big",
  "الصغير": "small",
  "الطويل": "tall/long",
  "القصير": "short",
  "الجديد": "new",
  "القديم": "old",
  
  // Religious practices and concepts
  "الوضوء": "Ablution (ritual washing)",
  "الطهارة": "Purity",
  "النجاسة": "Impurity",
  "القبلة": "Qibla (direction of prayer)",
  "الركوع": "Bowing (in prayer)",
  "السجود": "Prostration",
  "التشهد": "Tashahhud (testimony in prayer)",
  "التكبير": "Takbir (saying Allahu Akbar)",
  "التسبيح": "Tasbih (glorification of Allah)",
  "التحميد": "Tahmid (praising Allah)",
  "الاستغفار": "Istighfar (seeking forgiveness)",
  "الدعاء": "Supplication/prayer",
  "الذكر": "Dhikr (remembrance of Allah)",
  "التلاوة": "Recitation",
  "التفسير": "Tafsir (Quranic commentary)",
  "الفقه": "Fiqh (Islamic jurisprudence)",
  "العقيدة": "Aqeedah (creed)",
  "الشريعة": "Sharia (Islamic law)",
  "الحلال": "Halal (lawful)",
  "الحرام": "Haram (forbidden)",
  "المكروه": "Makrooh (disliked)",
  "المستحب": "Mustahab (recommended)",
  "الواجب": "Wajib (obligatory)",
  "الفرض": "Fard (obligatory)",
  "سُنة": "Sunnah (recommended)",
  "البدعة": "Bidah (innovation in religion)",
  "الجماعة": "Congregation/community",
  "الأمة": "Ummah (Muslim community)",
  "الخليفة": "Caliph",
  "الإمام": "Imam",
  "الشيخ": "Sheikh/scholar",
  "العالم": "Scholar",
  "طالب": "Student of knowledge",
  "المجتهد": "Mujtahid (qualified scholar)",
  "المقلد": "Muqallid (follower of madhab)",
  "المذهب": "Madhab (school of thought)",
};

// Function to get translation for a word
export const getTranslation = (word: string): string | null => {
  // Remove diacritics and punctuation for better matching
  const cleanWord = word.replace(/[ًٌٍَُِّْ،؛]/g, '').trim();
  
  // Try exact match first
  if (arabicDictionary[cleanWord]) {
    return arabicDictionary[cleanWord];
  }
  
  // Try without definite article (ال)
  if (cleanWord.startsWith('ال') && cleanWord.length > 2) {
    const withoutAl = cleanWord.substring(2);
    if (arabicDictionary[withoutAl]) {
      return arabicDictionary[withoutAl];
    }
  }
  
  // Try adding definite article
  const withAl = 'ال' + cleanWord;
  if (arabicDictionary[withAl]) {
    return arabicDictionary[withAl];
  }
  
  return null;
};