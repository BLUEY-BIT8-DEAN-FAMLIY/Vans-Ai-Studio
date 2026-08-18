<div align="center">

# 🎨 Vans AI Studio

**סטודיו יצירה חופשי — תמונות · וידאו · מוזיקה · תלת־ממד · מודלים מותאמים**
**Free AI studio — images · video · music · 3D · custom models**

*בלי מפתח API · בלי תשלום · No API key · No payment*

</div>

---

## 🚀 התקנה בפקודה אחת / One-line install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/deanavraham-bit/Vans-Ai-Studio/main/installers/install.ps1 | iex
```

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/deanavraham-bit/Vans-Ai-Studio/main/installers/install.sh | bash
```

ואז פשוט מריצים / then just run:

```bash
vurs
```

`vurs` פותח את אפליקציית הדסקטופ אם הותקנה, או את גרסת ה-Web. `vurs web` תמיד פותח את גרסת ה-Web.

## 📦 הורדות / Downloads

כל הקבצים בעמוד ה-[Releases](https://github.com/deanavraham-bit/Vans-Ai-Studio/releases):

| קובץ / File | פלטפורמה / Platform |
|---|---|
| `VansAiStudio-Setup-*.exe` | Windows (installer) |
| `VansAiStudio-Portable-*.exe` | Windows (portable) |
| `VansAiStudio-*-mac.dmg` | macOS |
| `VansAiStudio-*.AppImage` | Linux |
| `VansAiStudio-Android.apk` | Android |

🌐 **גרסת Web (בלי התקנה):** https://deanavraham-bit.github.io/Vans-Ai-Studio/

💡 הורדתם את הקוד? הריצו `vurs` מתוך תיקיית הפרויקט (או לחיצה כפולה על `vurs.bat` ב-Windows / `./vurs` ב-Mac/Linux) כדי לפתוח את האפליקציה מיד בדפדפן — בלי שום התקנה.

## ✨ מה יש בפנים / Features

- 🧭 **תפריט צד** — הניווט בסרגל צד (מימין בעברית, משמאל באנגלית); במסכים צרים הופך למגירה נשלפת.
- 🎨 **יצירת תמונות** — מנועי Flux ו-Turbo דרך [Pollinations.ai](https://pollinations.ai), שירות קוד פתוח חינמי **ללא מפתח API**. כולל שיפור פרומפטים אוטומטי (מעולה לעברית!), seed, גדלים, וגלריה.
- 🧠 **מודלים** — צרו "מודל" משלכם (פרופיל סגנון חכם מעל מנועי הבסיס): שם, תיאור, הנחיות סגנון. ייצוא כקובץ `.vansmodel.json`, שיתוף, ייבוא והורדה. מגיע עם קטלוג של 10 מודלים מובנים (Vans Realistic Pro, Vans Anime XL ועוד).
- 🎬 **יצירת וידאו** — סרטונים מסצנות AI עם תנועה קולנועית (קן ברנס, זום), ייצוא WebM. בלי מפתח API.
- 🎵 **יצירת מוזיקה** — מנוע מוזיקה גנרטיבי שרץ **כולו במכשיר** (Web Audio): Lo-Fi, צ'יפטיון, טכנו, אמביינט. עובד גם בלי אינטרנט, ייצוא WAV.
- 🧊 **תלת־ממד להדפסה** — שלטי טקסט (גם בעברית!), תבליטים וליתופנים מ-AI או מתמונה שלכם, ואזות פרמטריות וצורות. ייצוא **STL** שנפתח ב-XMaker, Bambu Studio, Cura, PrusaSlicer ובכל סלייסר. קנה מידה 1:1 מ"מ.

## 🖥️ הרצה מקומית / Run from source

```bash
git clone https://github.com/deanavraham-bit/Vans-Ai-Studio.git
```

```bash
cd Vans-Ai-Studio && npm install && npm start
```

- `npm start` — אפליקציית דסקטופ (Electron)
- `Start-Web.bat` / `./start-web.sh` — גרסת דפדפן, בלי תלויות
- `npm run dist:win` — בניית EXE מקומית

קבצי ההתקנה לכל הפלטפורמות נבנים אוטומטית ב-GitHub Actions על כל תג `v*` (ראו `.github/workflows/release.yml`).

## 📖 הסבר טכני מלא / Full technical explanation

**[HOW-IT-WORKS.md](HOW-IT-WORKS.md)** — a complete English explanation of how every part works: the free keyless backends, the proxy routing and serial request queue, the custom model system, and the local music and 3D engines.

## 🔍 שקיפות / How it really works

- **תמונות ווידאו** נוצרים ע"י שירות Pollinations.ai — פתוח וחינמי, לא נדרש מפתח או הרשמה. (בעומס ייתכנו המתנות קצרות.)
- **מוזיקה ותלת־ממד** נוצרים ע"י מנועים מקומיים שכתובים בתוך האפליקציה — אפס תלות בענן.
- **"מודל"** ב-Vans AI Studio הוא פרופיל סגנון (הנחיות + פרמטרים) שרץ מעל מנועי הבסיס — לא אימון רשת נוירונים מאפס. זה מה שמאפשר לזה להיות מיידי, חינמי וניתן לשיתוף כקובץ קטן.

## License

MIT
