// Unified AI Service for local and cloud models - MedhaAI

export async function callAI(config, systemPrompt, userPrompt) {
  const provider = config.provider || 'ollama';
  const model = config.model || (provider === 'ollama' ? 'gemma2' : provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
  
  if (provider === 'demo') {
    // Simulate AI network latency
    await new Promise(resolve => setTimeout(resolve, 800));
    return handleDemoAI(systemPrompt, userPrompt);
  }
  
  if (provider === 'ollama') {
    const endpoint = config.endpoint || 'http://localhost:11434';
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.message.content;
    } catch (err) {
      console.error("Ollama connection failed:", err);
      throw new Error(`Ollama Error: Could not connect to local server at ${endpoint}. Make sure Ollama is running and OLLAMA_ORIGINS="*" is set. Error detail: ${err.message}`);
    }
  } 
  
  else if (provider === 'gemini') {
    if (!config.apiKey) {
      throw new Error("Gemini Error: API Key is required for Cloud Inference.");
    }
    
    const combinedPrompt = `System Instructions:\n${systemPrompt}\n\nUser Request:\n${userPrompt}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: combinedPrompt }]
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini HTTP error! status: ${response.status}, message: ${errText}`);
      }
      
      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Gemini Error: Unexpected API response format");
      }
    } catch (err) {
      console.error("Gemini connection failed:", err);
      throw new Error(`Gemini API Error: ${err.message}`);
    }
  } 
  
  else if (provider === 'openai') {
    if (!config.apiKey) {
      throw new Error("OpenAI Error: API Key is required for Cloud Inference.");
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI HTTP error! status: ${response.status}, message: ${errText}`);
      }
      
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        throw new Error("OpenAI Error: Unexpected response format");
      }
    } catch (err) {
      console.error("OpenAI connection failed:", err);
      throw new Error(`OpenAI API Error: ${err.message}`);
    }
  }
  
  throw new Error("Unknown AI provider selected.");
}

export async function testConnection(config) {
  const systemPrompt = "Respond with a single short greeting sentence stating your model name.";
  const userPrompt = "Hello! Test connection.";
  return callAI(config, systemPrompt, userPrompt);
}

function getLanguageName(langCode) {
  if (langCode === 'hi') return 'Hindi (हिन्दी)';
  if (langCode === 'ta') return 'Tamil (தமிழ்)';
  return 'English';
}

export async function simplifyConcept(config, text, targetLang) {
  const languageName = getLanguageName(targetLang);
  const systemPrompt = `You are an expert educator. You are given complex academic textbook text or syllabus topics in English.
Your task is to:
1. Translate the topic title and content concepts into the target language (${languageName}).
2. Simplify the concepts using the native script (Devanagari for Hindi, Tamil script for Tamil).
3. Provide a clear explanation using familiar Indian local analogies/examples (e.g. comparing electric current to flowing water pipes, gravity to a falling coconut/mango, inflation to pocket money).
4. Structure the notes in clean, formatted Markdown headers, lists, and bold terms. Avoid complex jargon; write in a style that a high school student can easily comprehend.`;

  const userPrompt = `Concept to simplify and translate:\n\n${text}`;
  return callAI(config, systemPrompt, userPrompt);
}

export async function generateQuiz(config, topic, difficulty, targetLang) {
  const languageName = getLanguageName(targetLang);
  const systemPrompt = `You are an academic test maker. Your task is to generate a 3-question multiple-choice quiz about the user's topic: "${topic}" at difficulty level: "${difficulty}".
You MUST output the quiz strictly as a valid JSON array of objects. Do not wrap the JSON in HTML. If you write markdown code blocks, use standard \`\`\`json.
Each object in the JSON array must contain exactly these properties:
1. "question": The question text in the ${languageName} language (using native script Devanagari for Hindi, Tamil script for Tamil).
2. "options": An array of exactly 4 choices/options in the ${languageName} language.
3. "correctIndex": An integer (0, 1, 2, or 3) representing the index of the correct option.
4. "explanation": A detailed step-by-step explanation of why that option is correct, written in the ${languageName} language.

Ensure the questions are scientifically/historically accurate and strictly test the topic: "${topic}".`;

  const userPrompt = `Generate a 3-question MCQ quiz in JSON format. Topic: ${topic}`;
  return callAI(config, systemPrompt, userPrompt);
}

export async function decodeVocab(config, term, targetLang) {
  const languageName = getLanguageName(targetLang);
  const systemPrompt = `You are a scientific glossary indexer. You are given an academic term, Greek symbol, or formula in English (e.g. Photosynthesis, Delta, E=mc²).
Explain and decode it in the target language (${languageName}).
Provide:
1. Local translation of the term (e.g. Photosynthesis = प्रकाश संश्लेषण / ஒளிச்சேர்க்கை).
2. Plain language definition in native script (Devanagari for Hindi, Tamil script for Tamil).
3. Break down of components (e.g. if a formula like E=mc² or GDP = C+I+G+NX, define what each variable stands for).
4. Real-world analogy or application in daily life.
Use clean Markdown formatting.`;

  const userPrompt = `Decode and translate: ${term}`;
  return callAI(config, systemPrompt, userPrompt);
}

export async function chatWithMitra(config, chatHistory, userMessage, targetLang) {
  const languageName = getLanguageName(targetLang);
  const systemPrompt = `You are Medha Mitra (मेधा मित्र / மேதா மித்ரா), a warm, supportive, and knowledgeable virtual study tutor for Indian students.
You explain complex concepts in Science, Mathematics, History, Geography, and other school/competitive subjects step-by-step.
Always answer the student's question in the ${languageName} language (using Devanagari for Hindi, Tamil script for Tamil).
Use encouraging words. If they ask a math or physics numerical problem, break down the formula, show the substitutions, and calculate the answer step-by-step clearly. Use Markdown formatting.`;

  let promptText = "";
  chatHistory.forEach(msg => {
    promptText += `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}\n`;
  });
  promptText += `Student: ${userMessage}\nTutor:`;

  return callAI(config, systemPrompt, promptText);
}

function handleDemoAI(systemPrompt, userPrompt) {
  const isQuiz = systemPrompt.toLowerCase().includes('json') || systemPrompt.toLowerCase().includes('mcq') || systemPrompt.toLowerCase().includes('quiz');
  const isSimplifier = systemPrompt.toLowerCase().includes('educator') || systemPrompt.toLowerCase().includes('simplifier');
  const isVocab = systemPrompt.toLowerCase().includes('glossary') || systemPrompt.toLowerCase().includes('vocab') || systemPrompt.toLowerCase().includes('decode');
  const isChat = systemPrompt.toLowerCase().includes('medha mitra');
  const isTest = systemPrompt.toLowerCase().includes('greeting') || userPrompt.toLowerCase().includes('test');

  const isHindi = systemPrompt.toLowerCase().includes('hindi') || systemPrompt.toLowerCase().includes('हिन्दी') || userPrompt.toLowerCase().includes('hindi');
  const isTamil = systemPrompt.toLowerCase().includes('tamil') || systemPrompt.toLowerCase().includes('தமிழ்') || userPrompt.toLowerCase().includes('tamil');
  const lang = isHindi ? 'hi' : isTamil ? 'ta' : 'en';

  if (isTest) {
    return "Hello! I am the simulated MedhaAI reasoning engine (v1.0). Connection diagnostics verified successfully.";
  }

  if (isQuiz) {
    const topicNorm = userPrompt.toLowerCase();
    
    // Photosynthesis Quiz
    if (topicNorm.includes('photo') || topicNorm.includes('प्रकाश') || topicNorm.includes('ஒளி')) {
      if (lang === 'hi') {
        return JSON.stringify([
          {
            "question": "प्रकाश संश्लेषण के दौरान कौन सा वर्णक प्रकाश ऊर्जा को अवशोषित करता है?",
            "options": ["क्लोरोफिल-ए (Chlorophyll-a)", "कैरोटीनॉयड (Carotenoid)", "ज़ैंथोफिल (Xanthophyll)", "एंथोसायनिन (Anthocyanin)"],
            "correctIndex": 0,
            "explanation": "क्लोरोफिल-ए प्राथमिक वर्णक है जो प्रकाश संश्लेषण के लिए लाल और नीले प्रकाश को अवशोषित करता है।"
          },
          {
            "question": "प्रकाश संश्लेषण के लिए आवश्यक कच्चे माल क्या हैं?",
            "options": ["कार्बन डाइऑक्साइड और पानी", "ग्लूकोज और ऑक्सीजन", "नाइट्रोलन और कार्बन", "हीलियम और हाइड्रोजन"],
            "correctIndex": 0,
            "explanation": "पौधे ग्लूकोज (भोजन) को संश्लेषित करने के लिए हवा से कार्बन डाइऑक्साइड (CO2) और मिट्टी से पानी (H2O) लेते हैं।"
          },
          {
            "question": "प्रकाश संश्लेषण की प्रकाश-निर्भर प्रतिक्रिया क्लोरोप्लास्ट में कहाँ होती है?",
            "options": ["थायलाकोइड झिल्ली (Thylakoid Membrane)", "स्ट्रोमा (Stroma)", "कोशिकाद्रव्य (Cytoplasm)", "माइटोकॉन्ड्रिया (Mitochondria)"],
            "correctIndex": 0,
            "explanation": "प्रकाश-निर्भर प्रतिक्रियाएं क्लोरोप्लास्ट के अंदर थायलाकोइड झिल्ली (Thylakoid Membranes) में होती हैं, जहाँ प्रकाश अवशोषित होता है।"
          }
        ]);
      } else if (lang === 'ta') {
        return JSON.stringify([
          {
            "question": "ஒளிச்சேர்க்கையின் போது எந்த நிறமி ஒளி ஆற்றலை உறிஞ்சுகிறது?",
            "options": ["குளோரோபில்-ஏ (குளோரோபில் அ)", "கரோட்டினாய்டு (கரோட்டினாய்டு)", "சாந்தோபில் (சாந்தோபில்)", "அந்தோசயனின் (அந்தோசயனின்)"],
            "correctIndex": 0,
            "explanation": "குளோரோபில்-ஏ என்பது ஒளிச்சேர்க்கைக்கான சிவப்பு மற்றும் நீல ஒளியை உறிஞ்சும் முதன்மை நிறமியாகும்."
          },
          {
            "question": "ஒளிச்சேர்க்கைக்கு தேவையான முக்கிய மூலப்பொருட்கள் யாவை?",
            "options": ["கார்பன் டை ஆக்சைடு மற்றும் நீர்", "குளுக்கோஸ் மற்றும் ஆக்ஸிஜன்", "நைட்ரஜன் மற்றும் கார்பன்", "ஹீலியம் மற்றும் ஹைட்ரஜன்"],
            "correctIndex": 0,
            "explanation": "தாவரங்கள் குளுக்கோஸைத் தயாரிக்க காற்றில் இருந்து கார்பன் டை ஆக்சைடையும், மண்ணிலிருந்து நீரையும் பெறுகின்றன."
          },
          {
            "question": "ஒளிச்சேர்க்கையின் ஒளி சார்ந்த வினை பசுங்கணிகத்தில் எங்கு நடைபெறுகிறது?",
            "options": ["தைலகாய்டு சவ்வு (Thylakoid Membrane)", "ஸ்ட்ரோமா (Stroma)", "சைட்டோபிளாசம் (Cytoplasm)", "மைட்டோகாண்ட்ரியா (Mitochondria)"],
            "correctIndex": 0,
            "explanation": "ஒளி சார்ந்த வினைகள் பசுங்கணிகத்தின் தைலகாய்டு சவ்வுகளுக்குள் நடைபெறுகின்றன."
          }
        ]);
      } else {
        return JSON.stringify([
          {
            "question": "Which pigment absorbs light energy during photosynthesis?",
            "options": ["Chlorophyll a", "Carotenoid", "Xanthophyll", "Anthocyanin"],
            "correctIndex": 0,
            "explanation": "Chlorophyll a is the primary pigment that absorbs red and blue light for photosynthesis."
          },
          {
            "question": "What are the raw materials needed for photosynthesis?",
            "options": ["Carbon dioxide and water", "Glucose and oxygen", "Nitrogen and carbon", "Helium and hydrogen"],
            "correctIndex": 0,
            "explanation": "Plants take carbon dioxide from the air and water from the soil to synthesize glucose."
          },
          {
            "question": "Where do the light-dependent reactions of photosynthesis occur?",
            "options": ["Thylakoid membrane", "Stroma", "Cytoplasm", "Mitochondria"],
            "correctIndex": 0,
            "explanation": "The light-dependent reactions take place inside the thylakoid membranes of chloroplasts."
          }
        ]);
      }
    }
    
    // Newton's Laws / Gravitation Quiz
    if (topicNorm.includes('gravit') || topicNorm.includes('newton') || topicNorm.includes('गुरुत्वाकर्षण') || topicNorm.includes('गति') || topicNorm.includes('விசை') || topicNorm.includes('ஈர்ப்பு')) {
      if (lang === 'hi') {
        return JSON.stringify([
          {
            "question": "न्यूटन के गति के प्रथम नियम को किस नाम से भी जाना जाता है?",
            "options": ["जड़त्व का नियम (Law of Inertia)", "त्वरण का नियम", "क्रिया-प्रतिक्रिया का नियम", "गुरुत्वाकर्षण का नियम"],
            "correctIndex": 0,
            "explanation": "न्यूटन का पहला नियम कहता है कि कोई वस्तु तब तक अपनी गति या विराम की अवस्था में रहती है जब तक कि उस पर कोई बाहरी बल न लगाया जाए, जिसे जड़त्व का नियम कहते हैं।"
          },
          {
            "question": "पृथ्वी की सतह पर गुरुत्वीय त्वरण (g) का औसत मान क्या है?",
            "options": ["9.8 m/s²", "8.9 m/s²", "1.6 m/s²", "12.0 m/s²"],
            "correctIndex": 0,
            "explanation": "पृथ्वी की सतह पर औसत गुरुत्वीय त्वरण लगभग 9.8 मीटर प्रति वर्ग सेकंड होता है।"
          },
          {
            "question": "प्रत्येक क्रिया के लिए एक समान और विपरीत प्रतिक्रिया होती है। यह न्यूटन का कौन सा नियम है?",
            "options": ["प्रथम नियम", "द्वितीय नियम", "तृतीय नियम", "गुरुत्वाकर्षण का सार्वत्रिक नियम"],
            "correctIndex": 2,
            "explanation": "न्यूटन का तीसरा नियम बताता है कि बल हमेशा समान और विपरीत क्रिया-प्रतिक्रिया युग्मों में होते हैं।"
          }
        ]);
      } else if (lang === 'ta') {
        return JSON.stringify([
          {
            "question": "நியூட்டனின் முதல் இயக்க விதி வேறு எவ்வாறு அழைக்கப்படுகிறது?",
            "options": ["நிலைம விதி (Law of Inertia)", "முடுக்க விதி", "விசை விதி", "ஈர்ப்பு விதி"],
            "correctIndex": 0,
            "explanation": "ஒரு பொருளின் மீது வெளிப்புற விசை செயல்படும் வரை அது தனது ஓய்வு நிலையையோ அல்லது இயக்க நிலையையோ மாற்றாது என்பதை விளக்குவது நிலைம விதியாகும்."
          },
          {
            "question": "பூமியின் மேற்பரப்பில் புவியீர்ப்பு முடுக்கத்தின் (g) சராசரி மதிப்பு என்ன?",
            "options": ["9.8 m/s²", "8.9 m/s²", "1.6 m/s²", "12.0 m/s²"],
            "correctIndex": 0,
            "explanation": "பூமியின் மேற்பரப்பில் சராசரி புவியீர்ப்பு முடுக்கம் தோராயமாக 9.8 m/s² ஆகும்."
          },
          {
            "question": "ஒவ்வொரு வினைக்கும் ஒரு சமமான மற்றும் எதிர் வினை உண்டு. இது எந்த விதி?",
            "options": ["முதல் விதி", "இரண்டாம் விதி", "மூன்றாம் விதி", "பொது ஈர்ப்பு விதி"],
            "correctIndex": 2,
            "explanation": "நியூட்டனின் மூன்றாம் விதி, விசைகள் எப்போதும் சமமான மற்றும் எதிர் வினை ஜோடிகளாகவே நிகழ்கின்றன என்று கூறுகிறது."
          }
        ]);
      } else {
        return JSON.stringify([
          {
            "question": "What is Newton's First Law of Motion also known as?",
            "options": ["Law of Inertia", "Law of Acceleration", "Law of Action-Reaction", "Universal Gravitation"],
            "correctIndex": 0,
            "explanation": "Newton's First Law states that an object remains at rest or in uniform motion unless acted upon by an external force, which is the definition of inertia."
          },
          {
            "question": "What is the average value of gravitational acceleration (g) on Earth's surface?",
            "options": ["9.8 m/s²", "8.9 m/s²", "1.6 m/s²", "12.0 m/s²"],
            "correctIndex": 0,
            "explanation": "The average gravitational acceleration at Earth's surface is approximately 9.8 m/s²."
          },
          {
            "question": "For every action, there is an equal and opposite reaction. Which law is this?",
            "options": ["First Law", "Second Law", "Third Law", "Universal Law of Gravitation"],
            "correctIndex": 2,
            "explanation": "Newton's Third Law states that forces always occur in equal and opposite action-reaction pairs."
          }
        ]);
      }
    }

    // Default science fallback quiz
    if (lang === 'hi') {
      return JSON.stringify([
        {
          "question": "निम्नलिखित में से कौन सा ऊर्जा का नवीकरणीय (renewable) स्रोत है?",
          "options": ["सौर ऊर्जा (Solar Energy)", "कोयला (Coal)", "पेट्रोलियम (Petroleum)", "प्राकृतिक गैस (Natural Gas)"],
          "correctIndex": 0,
          "explanation": "सौर ऊर्जा सूर्य से प्राप्त होती है और यह कभी समाप्त नहीं होती, इसलिए यह नवीकरणीय है।"
        },
        {
          "question": "पानी का रासायनिक सूत्र क्या है?",
          "options": ["H2O", "CO2", "NaCl", "O2"],
          "correctIndex": 0,
          "explanation": "पानी का अणु दो हाइड्रोजन परमाणुओं और एक ऑक्सीजन परमाणु से मिलकर बनता है, इसलिए इसका सूत्र H2O है।"
        },
        {
          "question": "पौधे वायुमंडल से मुख्य रूप से कौन सी गैस अवशोषित करते हैं?",
          "options": ["कार्बन डाइऑक्साइड (CO2)", "ऑक्सीजन (O2)", "नाइट्रोजन (N2)", "हाइड्रोजन (H2)"],
          "correctIndex": 0,
          "explanation": "पौधे प्रकाश संश्लेषण के दौरान अपना भोजन बनाने के लिए कार्बन डाइऑक्साइड (CO2) अवशोषित करते हैं।"
        }
      ]);
    } else if (lang === 'ta') {
      return JSON.stringify([
        {
          "question": "பின்வருவனவற்றில் எது புதுப்பிக்கத்தக்க ஆற்றல் மூலம் ஆகும்?",
          "options": ["சூரிய ஆற்றல் (Solar)", "நிலக்கரி (Coal)", "பெட்ரோலியம் (Petroleum)", "இயற்கை எரிவாயு (Natural Gas)"],
          "correctIndex": 0,
          "explanation": "சூரிய ஆற்றல் சூரியனில் இருந்து பெறப்படுகிறது மற்றும் தொடர்ந்து புதுப்பிக்கத்தக்கது."
        },
        {
          "question": "நீரின் வேதியியல் வாய்ப்பாடு என்ன?",
          "options": ["H2O", "CO2", "NaCl", "O2"],
          "correctIndex": 0,
          "explanation": "நீர் ஒரு ஆக்ஸிஜன் அணுவுடன் பிணைக்கப்பட்ட இரண்டு ஹைட்ரஜன் அணுக்களைக் கொண்டுள்ளது (H2O)."
        },
        {
          "question": "தாவரங்கள் ஒளிச்சேர்க்கைக்காக காற்றில் இருந்து உறிஞ்சும் வாயு எது?",
          "options": ["கார்பன் டை ஆக்சைடு (CO2)", "ஆக்ஸிஜன் (O2)", "நைட்ரஜன் (N2)", "ஹீலியம் (He)"],
          "correctIndex": 0,
          "explanation": "தாவரங்கள் ஒளிச்சேர்க்கையின் போது உணவு தயாரிக்க கார்பன் டை ஆக்சைடை உறிஞ்சுகின்றன."
        }
      ]);
    } else {
      return JSON.stringify([
        {
          "question": "Which of the following is a renewable source of energy?",
          "options": ["Solar Energy", "Coal", "Petroleum", "Natural Gas"],
          "correctIndex": 0,
          "explanation": "Solar energy is derived from the sun and is continuously replenished, making it renewable."
        },
        {
          "question": "What is the chemical formula for water?",
          "options": ["H2O", "CO2", "NaCl", "O2"],
          "correctIndex": 0,
          "explanation": "Water consists of two hydrogen atoms bonded to one oxygen atom (H2O)."
        },
        {
          "question": "Which gas do plants absorb from the atmosphere for photosynthesis?",
          "options": ["Carbon Dioxide (CO2)", "Oxygen (O2)", "Nitrogen (N2)", "Hydrogen (H2)"],
          "correctIndex": 0,
          "explanation": "Plants absorb carbon dioxide (CO2) from the air to perform photosynthesis and make glucose."
        }
      ]);
    }
  }

  if (isSimplifier) {
    const textNorm = userPrompt.toLowerCase();
    
    if (textNorm.includes('photo') || textNorm.includes('leaf') || textNorm.includes('chlorophyll')) {
      if (lang === 'hi') {
        return `### प्रकाश संश्लेषण सरल शब्दों में (Photosynthesis Simplified)
**प्रकाश संश्लेषण** वह प्रक्रिया है जिसके द्वारा पौधे सूर्य के प्रकाश, पानी और कार्बन डाइऑक्साइड का उपयोग करके अपना भोजन (ग्लूकोज) बनाते हैं।

**सरल उपमा (Leaf as a Kitchen):**
पौधे की पत्ती को **सौर-ऊर्जा से चलने वाली रसोई** के रूप में सोचें:
- **सूर्य का प्रकाश** रसोई का गैस चूल्हा है।
- **कार्बन डाइऑक्साइड** (हवा से) और **पानी** (मिट्टी से) कच्ची सब्जियां और सामग्री हैं।
- **क्लोरोफिल (हरा रंग)** वह शेफ है जो भोजन पकाता है।
- **ग्लूकोज** तैयार स्वादिष्ट भोजन है जो पौधे को ऊर्जा देता है।
- **ऑक्सीजन** खाना पकाने के दौरान निकलने वाली भाप है, जिसे मनुष्यों के सांस लेने के लिए हवा में छोड़ दिया जाता है!`;
      } else if (lang === 'ta') {
        return `### ஒளிச்சேர்க்கை எளிய வடிவில் (Photosynthesis Simplified)
**ஒளிச்சேர்க்கை** என்பது தாவரங்கள் சூரிய ஒளி, நீர் மற்றும் கார்பன் டை ஆக்சைடு ஆகியவற்றைப் பயன்படுத்தி தங்களுக்குத் தேவையான உணவைத் (குளுக்கோஸ்) தயாரிக்கும் செயல்முறையாகும்.

**எளிய உதாரணம் (இலை ஒரு சமையலறை):**
தாவரத்தின் இலையை **சூரிய சக்தியில் இயங்கும் சமையலறையாக** கற்பனை செய்து பாருங்கள்:
- **சூரிய ஒளி** என்பது சமையல் அடுப்பு ஆகும்.
- **கார்பன் டை ஆக்சைடு** (காற்றிலிருந்து) மற்றும் **நீர்** (மண்ணிலிருந்து) சமையல் செய்யத் தேவையான காயறிகள் ஆகும்.
- **பச்சை நிறமி (குளோரோபில்)** என்பது சமையல் செய்யும் சமையல்காரர் (Chef) ஆவார்.
- **குளுக்கோஸ்** என்பது சமைத்து முடிக்கப்பட்ட சுவையான உணவு ஆகும்.
- **ஆக்ஸிஜன்** என்பது சமையலின் போது வெளியேறும் ஆவி (Steam) போன்றது, இது நாம் சுவாசிக்க காற்றில் வெளியிடப்படுகிறது!`;
      } else {
        return `### Photosynthesis Simplified
**Photosynthesis** is the process plants use to make food (glucose) using sunlight, water, and carbon dioxide.

**Simple Analogy (Leaf as a Kitchen):**
Think of a plant leaf as a **solar-powered kitchen**:
- The **sun** is the gas stove providing energy.
- **Carbon dioxide** (from air) and **water** (from roots) are the raw vegetables/ingredients.
- **Chlorophyll** is the chef who cooks the food.
- **Glucose** is the delicious cooked meal (food for the plant).
- **Oxygen** is the steam released during cooking (released into the air for us to breathe!).`;
      }
    }

    if (textNorm.includes('gravit') || textNorm.includes('newton') || textNorm.includes('motion') || textNorm.includes('force')) {
      if (lang === 'hi') {
        return `### न्यूटन के गति के नियम (Newton's Laws of Motion)
सर आइजैक न्यूटन ने भौतिक जगत में गति को समझाने के लिए तीन बुनियादी नियम दिए।

**सरल उपमा (Newton's Laws in Daily Life):**
- **पहला नियम (जड़त्व का नियम):** एक आलसी सोफा तब तक अपनी जगह से नहीं हिलता जब तक कि आप उसे धक्का न दें। यह आलस ही जड़त्व (Inertia) है!
- **दूसरा नियम (F = ma):** एक भारी पत्थर को फेंकने के लिए आपको एक छोटी प्लास्टिक की गेंद की तुलना में बहुत अधिक बल (Force) लगाना पड़ेगा।
- **तीसरा नियम (क्रिया-प्रतिक्रिया):** जब आप तैरते हैं, तो आप पानी को पीछे धकेलते हैं (क्रिया), और पानी आपको आगे धकेलता है (प्रतिक्रिया)।`;
      } else if (lang === 'ta') {
        return `### நியூட்டனின் இயக்க விதிகள் (Newton's Laws of Motion)
அறிவியலாளர் ஐசக் நியூட்டன் பொருட்களின் இயக்கத்தை விளக்கும் மூன்று விதிகளை வழங்கினார்.

**நிஜ உலக உதாரணங்கள் (Newton's Laws in Daily Life):**
- **முதல் விதி (நிலைம விதி):** ஒரு சோபா தானாக நகராது, யாராவது அதைத் தள்ளும் வரை அப்படியே இருக்கும். இந்த சோம்பேறித்தனமே நிலைமம் (Inertia) ஆகும்!
- **இரண்டாம் விதி (F = ma):** ஒரு கனமான கல்லை எறிய அதிக விசை தேவைப்படும், ஆனால் ஒரு சிறிய பந்தினை எறிய குறைந்த விசையே போதும்.
- **மூன்றாம் விதி (வினை-எதிர்வினை):** நாம் நடக்கும்போது, காலால் தரையைப் பின்னோக்கித் தள்ளுகிறோம் (வினை), தரை நம்மை முன்னோக்கித் தள்ளுகிறது (எதிர்வினை).`;
      } else {
        return `### Newton's Laws of Motion Simplified
Sir Isaac Newton formulated three laws describing the relationship between a body and the forces acting upon it.

**Daily Life Analogies:**
- **1st Law (Inertia):** A heavy table stays in its place unless someone pushes it. It resists change in state.
- **2nd Law (Force = mass x acceleration):** Kicking a light soccer ball is much easier and requires less force than kicking a heavy rock to make it accelerate.
- **3rd Law (Action & Reaction):** When walking, your foot pushes backward against the ground (action), and the ground pushes forward against your foot (reaction).`;
      }
    }

    // Default Simplification
    if (lang === 'hi') {
      return `### सरलीकृत अध्ययन नोट्स
आपकी दर्ज की गई अध्ययन सामग्री को मेधाएआई ने सरल भाषा में परिवर्तित कर दिया है:

- **मुख्य विचार:** यह अवधारणा हमारे दैनिक जीवन में ऊर्जा हस्तांतरण और स्थिरता से संबंधित है।
- **सरल उदाहरण:** इसे एक बहते पानी के नल की तरह समझें। यदि दबाव अधिक होगा तो पानी तेजी से बहेगा (वोल्टेज और करंट की तरह)।
- **याद रखने योग्य बिंदु:** जटिल शब्दों को छोटे-छोटे टुकड़ों में विभाजित करें और वास्तविक जीवन की घटनाओं से जोड़ें।`;
    } else if (lang === 'ta') {
      return `### எளிமைப்படுத்தப்பட்ட குறிப்புகள்
நீங்கள் உள்ளிட்ட கல்விப் பகுதி மேதாAI மூலம் எளிமையான குறிப்புகளாக மாற்றப்பட்டுள்ளது:

- **முக்கிய கருத்து:** இந்த தலைப்பு நம் அன்றாட வாழ்வில் ஆற்றல் பரிமாற்றம் மற்றும் சமநிலையை விளக்குகிறது.
- **எளிய உதாரணம்:** ஓடும் குழாய் தண்ணீரை போல இதை நினைத்துப் பாருங்கள். அழுத்தம் அதிகமாக இருந்தால் தண்ணீர் வேகமாக பாயும் (மின்னழுத்தம் மற்றும் மின்னோட்டம் போல).
- **நினைவில் கொள்ள வேண்டியவை:** கடினமான சொற்களை சிறு பகுதிகளாக உடைத்து, நிஜ உலக உதாரணங்களுடன் ஒப்பிட்டுப் படியுங்கள்.`;
    } else {
      return `### Simplified Study Notes
Your study material has been summarized and simplified by MedhaAI:

- **Core Concept:** This topic explains the balance of energy and movement in physical systems.
- **Simple Analogy:** Think of this like water flowing through a pipe. Higher pressure leads to a faster flow (similar to voltage and electrical current).
- **Takeaway:** Break down large equations into step-by-step descriptions and map them to physical everyday objects.`;
    }
  }

  if (isVocab) {
    const termNorm = userPrompt.toLowerCase();
    
    if (termNorm.includes('photo') || termNorm.includes('प्रकाश') || termNorm.includes('ஒளி')) {
      if (lang === 'hi') {
        return `### शब्दावली विश्लेषण: Photosynthesis (प्रकाश संश्लेषण)
1. **स्थानीय अनुवाद:** प्रकाश संश्लेषण (Photosynthesis) - पौधों में भोजन बनाने की प्रक्रिया।
2. **परिभाषा:** यह वह जैव-रासायनिक प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश की उपस्थिति में पानी (H2O) और कार्बन डाइऑक्साइड (CO2) का उपयोग करके ग्लूकोज (भोजन) और ऑक्सीजन बनाते हैं।
3. **रासायनिक सूत्र:**
   \\(6CO_2 + 6H_2O \\xrightarrow{\\text{Sunlight/Chlorophyll}} C_6H_{12}O_6 + 6O_2\\)
   - \\(CO_2\\): कार्बन डाइऑक्साइड (हवा से)।
   - \\(H_2O\\): पानी (मिट्टी से)।
   - \\(C_6H_{12}O_6\\): ग्लूकोज (ऊर्जा का मुख्य स्रोत)।
   - \\(O_2\\): ऑक्सीजन (हवा में छोड़ी गई)।
4. **दैनिक जीवन में उदाहरण:** हमारे घरों में लगे पौधे धूप में रहकर हवा को शुद्ध करते हैं और ऑक्सीजन बनाते हैं।`;
      } else if (lang === 'ta') {
        return `### சொற்களஞ்சிய விளக்கம்: Photosynthesis (ஒளிச்சேர்க்கை)
1. **வட்டார மொழிபெயர்ப்பு:** ஒளிச்சேர்க்கை (Photosynthesis) - தாவரங்களின் உணவு தயாரிப்பு முறை.
2. **வரையறை:** பசுமையான தாவரங்கள் சூரிய ஒளியின் முன்னிலையில் நீர் (H2O) மற்றும் கார்பன் டை ஆக்சைடு (CO2) ஆகியவற்றைப் பயன்படுத்தி குளுக்கோஸ் மற்றும் ஆக்ஸிஜனை உருவாக்கும் செயல்முறையாகும்.
3. **வேதியியல் சமன்பாடு:**
   \\(6CO_2 + 6H_2O \\xrightarrow{\\text{சூரிய ஒளி}} C_6H_{12}O_6 + 6O_2\\)
   - \\(CO_2\\): கார்பன் டை ஆக்சைடு.
   - \\(H_2O\\): நீர்.
   - \\(C_6H_{12}O_6\\): குளுக்கோஸ் (தாவர உணவு).
   - \\(O_2\\): ஆக்ஸிஜன்.
4. **நிஜ உலக உதாரணம்:** நம் வீட்டின் முன் உள்ள மரங்கள் பகலில் சூரிய ஒளியைப் பயன்படுத்தி நமக்குத் தேவையான தூய ஆக்ஸிஜனை உற்பத்தி செய்கின்றன.`;
      } else {
        return `### Vocab Breakdown: Photosynthesis
1. **Literal Meaning:** "Photo" = Light, "Synthesis" = Putting together. Combining molecules using light.
2. **Definition:** The biological process by which green plants convert light energy into chemical energy, creating glucose and oxygen from carbon dioxide and water.
3. **Formula Breakdown:**
   \\(6CO_2 + 6H_2O \\xrightarrow{\\text{Light}} C_6H_{12}O_6 + 6O_2\\)
   - \\(CO_2\\): Carbon Dioxide (taken from stomata in leaves).
   - \\(H_2O\\): Water (absorbed by roots from soil).
   - \\(C_6H_{12}O_6\\): Glucose (stored chemical energy).
   - \\(O_2\\): Oxygen gas (released into air).
4. **Everyday Example:** Indoor plants absorbing carbon dioxide and emitting oxygen under sunlight, acting as natural air purifiers.`;
      }
    }

    if (termNorm.includes('e=mc') || termNorm.includes('emc')) {
      if (lang === 'hi') {
        return `### सूत्र विश्लेषण: \\(E=mc^2\\) (द्रव्यमान-ऊर्जा तुल्यता)
1. **नाम:** अल्बर्ट आइंस्टीन का द्रव्यमान-ऊर्जा समीकरण (Mass-Energy Equivalence).
2. **परिभाषा:** यह सूत्र दर्शाता है कि द्रव्यमान (Mass) और ऊर्जा (Energy) एक ही सिक्के के दो पहलू हैं। द्रव्यमान को ऊर्जा में और ऊर्जा को द्रव्यमान में बदला जा सकता है।
3. **घटकों का ब्रेकडाउन:**
   - \\(E\\): ऊर्जा (Energy) - जूल में मापी जाती है।
   - \\(m\\): द्रव्यमान (Mass) - किलोग्राम में मापा जाता है।
   - \\(c^2\\): प्रकाश की गति का वर्ग (Speed of light squared) - जहाँ \\(c \\approx 3 \\times 10^8\\) मीटर/सेकंड है।
4. **दैनिक जीवन में उदाहरण:** परमाणु ऊर्जा संयंत्र और सूर्य इसी सिद्धांत पर काम करते हैं। सूर्य का थोड़ा सा द्रव्यमान भारी मात्रा में प्रकाश और गर्मी (ऊर्जा) में बदल रहा है।`;
      } else if (lang === 'ta') {
        return `### சூத்திர விளக்கம்: \\(E=mc^2\\) (நிறை-ஆற்றல் சமன்பாடு)
1. **பெயர்:** ஆல்பர்ட் ஐன்ஸ்டீனின் நிறை-ஆற்றல் சமன்பாடு (Mass-Energy Equivalence).
2. **வரையறை:** நிறை (Mass) மற்றும் ஆற்றல் (Energy) ஆகியவை ஒன்றோடொன்று தொடர்புடையவை என்பதையும், நிறையை ஆற்றலாக மாற்ற முடியும் என்பதையும் இச்சமன்பாடு விளக்குகிறது.
3. **சூத்திர விளக்கம்:**
   - \\(E\\): ஆற்றல் (Energy).
   - \\(m\\): நிறை (Mass).
   - \\(c^2\\): ஒளியின் திசைவேகத்தின் வர்க்கம் (Speed of light squared) - \\(c \\approx 3 \\times 10^8\\) m/s.
4. **நிஜ உலக உதாரணம்:** அணு உலைகள் மற்றும் சூரியனின் ஆற்றல் உற்பத்தி இந்த விதியின் அடிப்படையில் இயங்குகிறது. சூரியனின் சிறிய அளவு நிறை மிகப்பெரிய வெப்ப மற்றும் ஒளி ஆற்றலாக மாறுகிறது.`;
      } else {
        return `### Formula Decoder: \\(E=mc^2\\) (Mass-Energy Equivalence)
1. **Origins:** Formulated by Albert Einstein in 1905 as part of his theory of Special Relativity.
2. **Definition:** Mass and energy are interchangeable. A small amount of mass can be converted into a tremendous amount of energy.
3. **Component Breakdown:**
   - \\(E\\): Kinetic Energy (Joules)
   - \\(m\\): Mass (Kilograms)
   - \\(c\\): Speed of Light (approximately \\(3 \\times 10^8\\) meters per second)
4. **Everyday Analogy:** This is why stars (like our Sun) shine. Inside the Sun, hydrogen atoms fuse to form helium, losing a tiny amount of mass which is converted into massive amounts of solar energy that warms the Earth.`;
      }
    }

    // Default Vocab response
    if (lang === 'hi') {
      return `### शब्दावली विश्लेषण: "${userPrompt}"
1. **स्थानीय अर्थ:** इस शब्द का संबंध विज्ञान/गणित की बुनियादी अवधारणाओं से है।
2. **परिभाषा:** यह एक मानक शैक्षणिक शब्द है जिसका उपयोग क्रियाओं, संबंधों या गणनाओं को दर्शाने के लिए किया जाता है।
3. **मुख्य उपयोग:** परीक्षा में इस विषय पर 2 से 5 अंकों के प्रश्न पूछे जाते हैं।
4. **उदाहरण:** इसे समझने के लिए सामान्य वस्तुओं या घटनाओं को देखें।`;
    } else if (lang === 'ta') {
      return `### சொற்களஞ்சிய விளக்கம்: "${userPrompt}"
1. **வட்டார பொருள்:** இந்த சொல் அறிவியல்/கணிதத்தின் அடிப்படை தத்துவங்களுடன் தொடர்புடையது.
2. **வரையறை:** இது ஒரு நிலையான கல்விச் சொல்லாகும், இது ஒரு குறிப்பிட்ட நிகழ்வையோ அல்லது விதியையோ குறிக்கிறது.
3. **முக்கிய பயன்:** தேர்வுகளில் இந்த தலைப்பில் இருந்து 2 முதல் 5 மதிப்பெண் வினாக்கள் கேட்கப்படலாம்.
4. **நிஜ உலக உதாரணம்:** தினசரி வாழ்வில் நடக்கும் எளிய நிகழ்வுகளுடன் ஒப்பிட்டு இதை எளிதாக புரிந்து கொள்ளலாம்.`;
    } else {
      return `### Vocab Breakdown: "${userPrompt}"
1. **Subject Domain:** Academic Terminology.
2. **Definition:** A standard term representing structured properties, equations, or events in the syllabus.
3. **Components:** It is often represented by mathematical symbols or chemical formulations.
4. **Practical Use:** Understanding this term helps in solving conceptual questions in school and entrance tests.`;
    }
  }

  if (isChat) {
    const chatNorm = userPrompt.toLowerCase();
    
    if (chatNorm.includes('hello') || chatNorm.includes('hi') || chatNorm.includes('hey') || chatNorm.includes('नमस्ते') || chatNorm.includes('வணக்கம்')) {
      if (lang === 'hi') {
        return "नमस्ते! मैं **मेधा मित्र** हूँ, आपका व्यक्तिगत अध्ययन साथी। आप मुझसे भौतिकी, रसायन विज्ञान, जीव विज्ञान, गणित या सामाजिक अध्ययन का कोई भी प्रश्न पूछ सकते हैं। आज आपकी पढ़ाई में क्या मदद करूँ?";
      } else if (lang === 'ta') {
        return "வணக்கம்! நான் **மேதா மித்ரா**, உங்களது தனிப்பட்ட கல்வித் துணைவன். இயற்பியல், வேதியியல், உயிரியல், கணிதம் அல்லது சமூக அறிவியல் தொடர்பான எந்தவொரு கேள்வியையும் என்னிடம் கேட்கலாம். இன்று நான் உங்களுக்கு எவ்வாறு உதவ வேண்டும்?";
      } else {
        return "Hello! I am **Medha Mitra**, your virtual study tutor. You can ask me any question or clear your doubts in Physics, Chemistry, Biology, Math, or Social Studies. How can I help you today?";
      }
    }

    if (chatNorm.includes('gravity') || chatNorm.includes('gravitation') || chatNorm.includes('गुरुत्वाकर्षण') || chatNorm.includes('ஈர்ப்பு')) {
      if (lang === 'hi') {
        return `गुरुत्वाकर्षण (Gravity) ब्रह्मांड का एक अदृश्य बल है जो द्रव्यमान वाली सभी वस्तुओं को एक-दूसरे की ओर खींचता है।
        
**मुख्य बातें:**
1. **गुरुत्वाकर्षण बल का नियम:** अल्बर्ट आइंस्टीन और आइजैक न्यूटन ने इसे समझाया। न्यूटन के अनुसार:
   \\(F = G \\frac{m_1 m_2}{r^2}\\)
   - जहाँ \\(F\\) गुरुत्वाकर्षण बल है।
   - \\(G\\) गुरुत्वीय स्थिरांक है।
   - \\(m_1, m_2\\) वस्तुओं का द्रव्यमान है।
   - \\(r\\) उनके बीच की दूरी है।
2. **दैनिक उदाहरण:** पेड़ से सेब का नीचे गिरना, और पृथ्वी द्वारा चंद्रमा को अपनी कक्षा में बाँध कर रखना।
क्या आप इस सूत्र पर कोई गणितीय न्यूमेरिकल हल करना चाहते हैं?`;
      } else if (lang === 'ta') {
        return `புவியீர்ப்பு விசை (Gravity) என்பது பிரபஞ்சத்தில் உள்ள அனைத்து நிறைகொண்ட பொருட்களையும் ஒன்றை ஒன்று ஈர்க்கும் ஒரு கண்ணுக்கு தெரியாத விசையாகும்.
        
**முக்கிய குறிப்புகள்:**
1. **ஈர்ப்பு விசை விதி:** சர் ஐசக் நியூட்டன் இவ்விதியை வகுத்தார்:
   \\(F = G \\frac{m_1 m_2}{r^2}\\)
   - \\(F\\) என்பது ஈர்ப்பு விசை.
   - \\(G\\) என்பது ஈர்ப்பு மாறிலி.
   - \\(m_1, m_2\\) பொருட்கள் நிறை.
   - \\(r\\) இடைவெளி தூரம்.
2. **எளிய உதாரணம்:** மரத்திலிருந்து பழம் கீழே விழுவது, மற்றும் பூமி நிலவை தன் சுற்றுப்பாதையில் பிடித்து வைத்திருப்பது.
இந்த சூத்திரத்தை பயன்படுத்தி கணக்கு ஏதேனும் தீர்க்க வேண்டுமா?`;
      } else {
        return `**Gravity** is the invisible force that pulls objects with mass toward each other. It keeps your feet on the ground and holds the Earth in orbit around the Sun.
        
**Key Equations:**
Isaac Newton formulated the Law of Universal Gravitation:
\\(F = G \\frac{m_1 m_2}{r^2}\\)
- \\(F\\) is the gravitational force between two bodies.
- \\(G\\) is the gravitational constant (\\(6.674 \\times 10^{-11}\\) N·m²/kg²).
- \\(m_1, m_2\\) are the masses of the two objects.
- \\(r\\) is the distance between their centers.

Would you like me to show a step-by-step calculation using this formula?`;
      }
    }

    if (chatNorm.includes('math') || chatNorm.includes('quadratic') || chatNorm.includes('समीकरण') || chatNorm.includes('கணிதம்')) {
      if (lang === 'hi') {
        return `आइए एक द्विघात समीकरण (Quadratic Equation) \\(ax^2 + bx + c = 0\\) को हल करने का तरीका समझें:
        
**द्विघात सूत्र (Quadratic Formula):**
\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)

**उदाहरण:** \\(x^2 - 5x + 6 = 0\\) को हल करें।
- यहाँ \\(a = 1\\), \\(b = -5\\), \\(c = 6\\) है।
1. **विविक्तकर (Discriminant) \\(D\\) निकालें:**
   \\(D = b^2 - 4ac = (-5)^2 - 4(1)(6) = 25 - 24 = 1\\)
2. **सूत्र में मान रखें:**
   \\(x = \\frac{-(-5) \\pm \\sqrt{1}}{2(1)} = \\frac{5 \\pm 1}{2}\\)
   - \\(x_1 = \\frac{5+1}{2} = 3\\)
   - \\(x_2 = \\frac{5-1}{2} = 2\\)
अतः समीकरण के हल \\(x = 3\\) और \\(x = 2\\) हैं!`;
      } else if (lang === 'ta') {
        return `இருபடிச் சமன்பாட்டை (Quadratic Equation) \\(ax^2 + bx + c = 0\\) தீர்க்கும் முறையை பார்ப்போம்:
        
**இருபடி சூத்திரம் (Quadratic Formula):**
\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)

**உதாரணம்:** \\(x^2 - 5x + 6 = 0\\) ஐத் தீர்க்க.
- இங்கு \\(a = 1\\), \\(b = -5\\), \\(c = 6\\).
1. **தன்மைகாட்டி (Discriminant) \\(D\\) கணக்கிடுக:**
   \\(D = b^2 - 4ac = (-5)^2 - 4(1)(6) = 25 - 24 = 1\\)
2. **மதிப்புகளை பிரதியிடுக:**
   \\(x = \\frac{-(-5) \\pm \\sqrt{1}}{2(1)} = \\frac{5 \\pm 1}{2}\\)
   - \\(x_1 = \\frac{5+1}{2} = 3\\)
   - \\(x_2 = \\frac{5-1}{2} = 2\\)
எனவே, சமன்பாட்டின் தீர்வுகள் \\(x = 3\\) மற்றும் \\(x = 2\\) ஆகும்!`;
      } else {
        return `Let's solve a quadratic equation of the form \\(ax^2 + bx + c = 0\\) using the quadratic formula:

**Formula:**
\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)

**Example:** Solve \\(x^2 - 5x + 6 = 0\\)
- Here, \\(a = 1\\), \\(b = -5\\), and \\(c = 6\\).
1. **Calculate the Discriminant (\\(b^2 - 4ac\\)):**
   \\(D = (-5)^2 - 4(1)(6) = 25 - 24 = 1\\)
2. **Substitute values into the formula:**
   \\(x = \\frac{-(-5) \\pm \\sqrt{1}}{2(1)} = \\frac{5 \\pm 1}{2}\\)
   - Solution 1: \\(x = \\frac{5+1}{2} = 3\\)
   - Solution 2: \\(x = \\frac{5-1}{2} = 2\\)
Therefore, the roots are \\(x = 3\\) and \\(x = 2\\).`;
      }
    }

    // Default Chat Response
    if (lang === 'hi') {
      return `यह एक महत्वपूर्ण शैक्षणिक प्रश्न है। परीक्षा की दृष्टि से इसे इस प्रकार समझा जा सकता है:
      
- **मुख्य बिंदु 1:** इस अवधारणा का मुख्य आधार प्रकृति में मौजूद संतुलन है।
- **मुख्य बिंदु 2:** वैज्ञानिक सिद्धांतों के अनुसार, यह हमेशा निश्चित अनुपातों में होता है।
- **अध्ययन सलाह:** इस विषय पर अधिक स्पष्टता के लिए संबंधित सूत्रों और परिभाषाओं को लिखकर अभ्यास करें।
क्या आप चाहते हैं कि मैं इस विषय पर एक उदाहरण दूँ?`;
    } else if (lang === 'ta') {
      return `இது ஒரு முக்கியமான கல்வி சார்ந்த கேள்வி ஆகும். தேர்வுகளுக்குத் தேவையான விளக்கங்கள் இதோ:
      
- **முக்கிய புள்ளி 1:** இந்த கோட்பாட்டின் அடிப்படை இயற்கை விதிகளின் சீரான தன்மையே ஆகும்.
- **முக்கிய புள்ளி 2:** அறிவியல் கோட்பாடுகளின்படி, இது எப்போதுமே குறிப்பிட்ட விகிதங்களின் அடிப்படையில் நிகழ்கிறது.
- **படிப்பு ஆலோசனை:** இத்தலைப்பினை இன்னும் ஆழமாகப் புரிந்து கொள்ள சமன்பாடுகள் மற்றும் வரைபடங்களை வரைந்து பயிற்சி செய்யுங்கள்.
நான் இதற்கு வேறு ஏதேனும் உதாரணம் தர வேண்டுமா?`;
    } else {
      return `That is a solid study question. Here is a conceptual breakdown for your exam preparation:

- **Key aspect 1:** The fundamentals of this topic rest on physical conservation laws.
- **Key aspect 2:** In laboratory conditions, this reaction behaves in predictable quantities.
- **Tutor Advice:** Write down the definitions and key assumptions of this model, as they are frequently asked in assessments.

Would you like me to elaborate on any specific sub-part?`;
    }
  }
  return "AI Simulated Response Placeholder";
}
