/* Local document & presentation builder - runs entirely offline.
   The free text service moved behind a credit system (HTTP 402), so the Work
   tools cannot rely on it. This builds a properly structured, ready-to-edit
   draft from the topic alone, with no network and no API key. When the online
   writer is reachable it is used instead; this is the guaranteed fallback. */
const Templates = (() => {

  const isHeb = s => /[֐-׿]/.test(String(s || ''));

  /* Section plans per document type. Each entry: [heading, [bullet, ...]] */
  const PLANS = {
    he: {
      article: { title: t => t, sections: [
        ['מבוא', ['רקע כללי על ' + '{t}', 'למה הנושא רלוונטי כעת', 'מה יוצג במסמך']],
        ['עיקרי הדברים', ['נקודה מרכזית ראשונה', 'נקודה מרכזית שנייה', 'נקודה מרכזית שלישית']],
        ['ניתוח', ['יתרונות', 'אתגרים וסיכונים', 'השוואה לחלופות']],
        ['סיכום', ['המסקנה העיקרית', 'צעדי המשך מומלצים']]
      ]},
      report: { title: t => 'דוח: ' + t, sections: [
        ['תקציר מנהלים', ['הממצא המרכזי', 'ההמלצה העיקרית']],
        ['רקע', ['מטרת הדוח', 'תקופת הבדיקה', 'מקורות הנתונים']],
        ['ממצאים', ['ממצא 1', 'ממצא 2', 'ממצא 3']],
        ['ניתוח ומסקנות', ['מה עומד מאחורי הממצאים', 'השלכות על הפעילות']],
        ['המלצות', ['המלצה מיידית', 'המלצה לטווח בינוני', 'המלצה לטווח ארוך']]
      ]},
      letter: { title: t => 'הנדון: ' + t, sections: [
        ['פתיחה', ['לכבוד, ______', 'אני פונה אליכם בנושא ' + '{t}']],
        ['גוף המכתב', ['פירוט הבקשה או הפנייה', 'נימוקים ונתונים תומכים', 'מסמכים מצורפים']],
        ['סיום', ['בקשה לתשובה עד לתאריך ______', 'בברכה, ______']]
      ]},
      email: { title: t => 'נושא: ' + t, sections: [
        ['פתיחה', ['שלום ______,']],
        ['העניין', ['מה נדרש בקשר ל' + '{t}', 'רקע קצר', 'לוח זמנים']],
        ['סיום', ['אשמח לתשובה עד ______', 'תודה, ______']]
      ]},
      summary: { title: t => 'סיכום: ' + t, sections: [
        ['במה מדובר', ['תיאור קצר של ' + '{t}']],
        ['נקודות מרכזיות', ['נקודה 1', 'נקודה 2', 'נקודה 3', 'נקודה 4']],
        ['מסקנה', ['השורה התחתונה']]
      ]},
      plan: { title: t => 'תוכנית עבודה: ' + t, sections: [
        ['מטרה', ['היעד המרכזי של ' + '{t}', 'מדדי הצלחה']],
        ['שלב 1 — הכנה', ['מיפוי מצב קיים', 'הגדרת בעלי תפקידים', 'תקציב נדרש']],
        ['שלב 2 — ביצוע', ['משימה מרכזית', 'אבני דרך', 'לוח זמנים']],
        ['שלב 3 — בקרה', ['מדידה מול היעדים', 'הפקת לקחים']],
        ['סיכונים', ['סיכון מרכזי ודרך התמודדות']]
      ]},
      cv: { title: t => t, sections: [
        ['פרטים אישיים', ['שם מלא: ______', 'טלפון: ______', 'דוא"ל: ______']],
        ['תמצית מקצועית', ['משפט אחד על הניסיון והכיוון']],
        ['ניסיון תעסוקתי', ['תפקיד, חברה, שנים — עיקרי האחריות', 'תפקיד קודם, חברה, שנים']],
        ['השכלה', ['תואר, מוסד, שנים']],
        ['כישורים', ['כישור 1', 'כישור 2', 'שפות']]
      ]},
      protocol: { title: t => 'פרוטוקול ישיבה: ' + t, sections: [
        ['פרטי הישיבה', ['תאריך: ______', 'משתתפים: ______', 'רשם/ה: ______']],
        ['נושאים שנדונו', ['נושא ראשון בהקשר ' + '{t}', 'נושא שני', 'נושא שלישי']],
        ['החלטות', ['החלטה 1', 'החלטה 2']],
        ['משימות להמשך', ['משימה — אחראי — תאריך יעד', 'משימה — אחראי — תאריך יעד']]
      ]}
    },
    en: {
      article: { title: t => t, sections: [
        ['Introduction', ['Background on {t}', 'Why this matters now', 'What this document covers']],
        ['Key points', ['First key point', 'Second key point', 'Third key point']],
        ['Analysis', ['Benefits', 'Challenges and risks', 'Comparison with alternatives']],
        ['Conclusion', ['The main takeaway', 'Recommended next steps']]
      ]},
      report: { title: t => 'Report: ' + t, sections: [
        ['Executive summary', ['The headline finding', 'The main recommendation']],
        ['Background', ['Purpose of this report', 'Period covered', 'Data sources']],
        ['Findings', ['Finding 1', 'Finding 2', 'Finding 3']],
        ['Analysis', ['What is driving these findings', 'Impact on operations']],
        ['Recommendations', ['Immediate', 'Medium term', 'Long term']]
      ]},
      letter: { title: t => 'Re: ' + t, sections: [
        ['Opening', ['Dear ______,', 'I am writing regarding {t}']],
        ['Body', ['Details of the request', 'Supporting reasons and figures', 'Attached documents']],
        ['Closing', ['I would appreciate a reply by ______', 'Sincerely, ______']]
      ]},
      email: { title: t => 'Subject: ' + t, sections: [
        ['Greeting', ['Hi ______,']],
        ['The ask', ['What is needed regarding {t}', 'Short background', 'Timeline']],
        ['Closing', ['Could you reply by ______?', 'Thanks, ______']]
      ]},
      summary: { title: t => 'Summary: ' + t, sections: [
        ['What this is about', ['Short description of {t}']],
        ['Key points', ['Point 1', 'Point 2', 'Point 3', 'Point 4']],
        ['Bottom line', ['The conclusion']]
      ]},
      plan: { title: t => 'Work plan: ' + t, sections: [
        ['Goal', ['The main objective of {t}', 'Success measures']],
        ['Phase 1 - Preparation', ['Map the current state', 'Assign owners', 'Budget needed']],
        ['Phase 2 - Execution', ['Core task', 'Milestones', 'Timeline']],
        ['Phase 3 - Review', ['Measure against targets', 'Lessons learned']],
        ['Risks', ['Main risk and mitigation']]
      ]},
      cv: { title: t => t, sections: [
        ['Personal details', ['Full name: ______', 'Phone: ______', 'Email: ______']],
        ['Profile', ['One sentence on your experience and direction']],
        ['Experience', ['Role, company, years - key responsibilities', 'Previous role, company, years']],
        ['Education', ['Degree, institution, years']],
        ['Skills', ['Skill 1', 'Skill 2', 'Languages']]
      ]},
      protocol: { title: t => 'Meeting minutes: ' + t, sections: [
        ['Meeting details', ['Date: ______', 'Attendees: ______', 'Minutes by: ______']],
        ['Topics discussed', ['First topic regarding {t}', 'Second topic', 'Third topic']],
        ['Decisions', ['Decision 1', 'Decision 2']],
        ['Action items', ['Task - owner - due date', 'Task - owner - due date']]
      ]}
    }
  };

  function pickLang(lang, topic) {
    if (lang === 'he' || lang === 'en') return lang;
    return isHeb(topic) ? 'he' : 'en';
  }

  /* Build document blocks for the Documents tool */
  function document(kind, topic, lang, len) {
    const L = pickLang(lang, topic);
    const plan = (PLANS[L] || PLANS.en)[kind] || PLANS[L].article;
    const fill = s => String(s).split('{t}').join(topic);
    const blocks = [{ type: 'title', text: fill(plan.title(topic)) }];

    // intro line so the draft never starts with a bare heading
    blocks.push({ type: 'p', text: L === 'he'
      ? 'טיוטה מובנית בנושא: ' + topic + '. אפשר לערוך כל שורה כאן ואז לייצא.'
      : 'A structured draft about: ' + topic + '. Edit any line here, then export.' });

    let sections = plan.sections;
    if (len === 'short') sections = sections.slice(0, Math.max(2, Math.ceil(sections.length / 2)));

    for (const [heading, bullets] of sections) {
      blocks.push({ type: 'h1', text: fill(heading) });
      const items = len === 'long' ? bullets : bullets.slice(0, len === 'short' ? 2 : bullets.length);
      for (const b of items) blocks.push({ type: 'bullet', text: fill(b) });
      if (len === 'long') {
        blocks.push({ type: 'p', text: L === 'he'
          ? 'הרחיבו כאן על ' + fill(heading).toLowerCase() + '.'
          : 'Expand here on ' + fill(heading).toLowerCase() + '.' });
      }
    }
    return blocks;
  }

  /* Build a slide deck for the Presentations tool */
  function deck(topic, count, lang) {
    const L = pickLang(lang, topic);
    const he = L === 'he';
    const slides = [{
      title: topic,
      bullets: he ? ['מצגת בנושא ' + topic, 'הוצג על ידי ______', 'תאריך: ______']
                  : ['A presentation about ' + topic, 'Presented by ______', 'Date: ______']
    }];

    const middle = he ? [
      ['רקע', ['מה המצב היום', 'למה זה חשוב עכשיו', 'מי מושפע מזה']],
      ['האתגר', ['הבעיה המרכזית', 'מה נוסה עד היום', 'מה חסר']],
      ['הפתרון המוצע', ['הרעיון בשורה אחת', 'איך זה עובד', 'למה זה שונה']],
      ['יתרונות', ['חיסכון בזמן', 'חיסכון בעלות', 'שיפור באיכות']],
      ['תוכנית ביצוע', ['שלב ראשון', 'שלב שני', 'אבני דרך']],
      ['נתונים ומדדים', ['מדד הצלחה מרכזי', 'יעד מספרי', 'איך נמדוד']],
      ['סיכונים', ['סיכון מרכזי', 'דרך התמודדות']],
      ['צעדים הבאים', ['החלטה נדרשת', 'מי אחראי', 'לוח זמנים']]
    ] : [
      ['Background', ['Where things stand today', 'Why it matters now', 'Who is affected']],
      ['The challenge', ['The core problem', 'What has been tried', 'What is missing']],
      ['Proposed solution', ['The idea in one line', 'How it works', 'Why it is different']],
      ['Benefits', ['Time saved', 'Cost saved', 'Quality improved']],
      ['Rollout plan', ['First phase', 'Second phase', 'Milestones']],
      ['Metrics', ['Key success metric', 'Target number', 'How we measure']],
      ['Risks', ['Main risk', 'Mitigation']],
      ['Next steps', ['Decision needed', 'Owner', 'Timeline']]
    ];

    const need = Math.max(1, count - 2);
    for (let i = 0; i < need; i++) {
      const [title, bullets] = middle[i % middle.length];
      slides.push({ title, bullets: bullets.slice() });
    }

    slides.push({
      title: he ? 'סיכום' : 'Summary',
      bullets: he ? ['הנקודה המרכזית', 'מה מבקשים להחליט', 'תודה — שאלות?']
                  : ['The key takeaway', 'What we are asking to decide', 'Thank you - questions?']
    });

    return slides.slice(0, count);
  }

  return { document, deck };
})();
