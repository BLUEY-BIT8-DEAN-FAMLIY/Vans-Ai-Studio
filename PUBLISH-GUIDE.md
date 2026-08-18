# העלאה לגיטהאב עם GitHub Desktop

הפרויקט כבר מוכן לחלוטין (git מאותחל, כל הקומיטים בוצעו, כל הקישורים מעודכנים
ל-`deanavraham-bit`). נשארו 3 שלבים.

---

## שלב 1 — התקנה והתחברות

1. הורד את GitHub Desktop: **https://desktop.github.com**
2. התקן ופתח.
3. `File` → `Options` → `Accounts` → **Sign in to GitHub.com**
   (נפתח דפדפן, מתחברים לחשבון, מאשרים — זה השלב שרק אתה יכול לעשות)

---

## שלב 2 — הוספת הפרויקט ופרסום

1. `File` → **`Add local repository...`**
2. בחר את התיקייה:

   ```
   C:\Users\Public\Documents\Vans Ai Studio
   ```

   GitHub Desktop יזהה שיש שם כבר repository עם כל ההיסטוריה. **לא** צריך ליצור חדש.

3. לחץ על הכפתור **`Publish repository`** (למעלה).
4. בחלון שנפתח — **חשוב, שתי בדיקות**:

   | שדה | מה לשים |
   |---|---|
   | **Name** | `Vans-Ai-Studio` ← בדיוק כך, עם המקפים |
   | **Keep this code private** | ☐ **לא מסומן!** |

   > למה חייב להיות ציבורי? כדי ש-GitHub Actions יבנה לך את קובצי ההתקנה בחינם,
   > שגרסת ה-Web תעלה, ושאנשים יוכלו להוריד. בפרטי כל זה חסום או בתשלום.

5. `Publish repository`. זה מעלה את כל הפרויקט. ✅

**כבר בשלב הזה גרסת ה-Web מתחילה לעלות אוטומטית** ל:
`https://deanavraham-bit.github.io/Vans-Ai-Studio/`
(לוקח 2–3 דקות בפעם הראשונה)

---

## שלב 3 — בניית קובצי ההתקנה (EXE / DMG / AppImage / APK)

GitHub Desktop לא שולח תגיות (tags), ולכן צריך להתחיל את הבנייה בלחיצה אחת:

1. פתח: **https://github.com/deanavraham-bit/Vans-Ai-Studio/actions**
2. בתפריט בצד שמאל בחר **`Build & Release`**
3. לחץ **`Run workflow`** → ואז שוב **`Run workflow`** (הכפתור הירוק)
4. חכה 10–20 דקות (הוא בונה במקביל על Windows, macOS, Linux ואנדרואיד)

בסיום כל הקבצים יופיעו כאן:
**https://github.com/deanavraham-bit/Vans-Ai-Studio/releases**

| קובץ | פלטפורמה |
|---|---|
| `VansAiStudio-Setup-1.0.0.exe` | Windows — התקנה |
| `VansAiStudio-Portable-1.0.0.exe` | Windows — בלי התקנה |
| `VansAiStudio-1.0.0-mac.dmg` | macOS |
| `VansAiStudio-1.0.0.AppImage` | Linux |
| `VansAiStudio-Android.apk` | Android |

---

## אחרי שהכול עלה

**מי שרוצה להתקין** מריץ בטרמינל:

```powershell
irm https://raw.githubusercontent.com/deanavraham-bit/Vans-Ai-Studio/main/installers/install.ps1 | iex
```

ואז פשוט:

```
vurs
```

---

## אם משהו נתקע

| בעיה | פתרון |
|---|---|
| הבנייה של אנדרואיד נכשלה | לא מפריע — שאר הקבצים עדיין מתפרסמים (הגדרתי `fail_on_unmatched_files: false`) |
| אין טאב Actions | הריפו כנראה פרטי — `Settings` → למטה → `Change visibility` → Public |
| גרסת ה-Web לא עולה | `Settings` → `Pages` → תחת Source בחר **GitHub Actions** |
| רוצה לשנות שם חשבון בקישורים | הקישורים מקובעים ל-`deanavraham-bit`; אם פרסמת בחשבון אחר, תגיד לי ואעדכן |
