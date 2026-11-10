# פתיחת סביבת פיתוח ל-WhatsApp עבור Elements · צעד אחר צעד

> נכתב 10.11.2026. המטרה: מספר בדיקה של Meta שאפשר לשלוח ממנו לטלפונים של הצוות בלבד, כדי לבדוק את החיבור ב-DEV.
> **בשלב הזה אין:** לקוחות, תשלום, אימות עסק, ואין נגיעה במספר 051-525-5387.
> שמות הכפתורים אצל Meta משתנים מדי פעם. אם משהו לא נמצא בשם הזה, הפונקציה היא מה שקובע.

## לפני שמתחילים
- **חשבון פייסבוק אישי** שלך. Meta דורשת חשבון אישי מאחורי חשבון מפתח.
- **גישה לעסק של Elements ב-Meta.** Elements מריצה קמפיינים ב-Meta, ולכן כמעט בוודאות כבר קיים Business Portfolio. **לא לפתוח חדש.** לבקש מבעל העסק להוסיף אותך:
  business.facebook.com → Settings → Users → People → Add → המייל שלך → הרשאה **Full control** (או לפחות גישה מלאה ל-Apps ול-WhatsApp accounts).
- **טלפון של הצוות** שישמש כנמען לבדיקות. הטלפון שלך מספיק.

## שלב 1 · חשבון מפתח
1. להיכנס ל-**developers.facebook.com** עם החשבון האישי.
2. **Get Started** → לאשר את התנאים → אימות טלפון או מייל → בתפקיד לבחור Developer.

## שלב 2 · אפליקציה
1. **My Apps** → **Create App**.
2. **Use case:** לבחור את האפשרות של WhatsApp (בדרך כלל "Connect with customers through WhatsApp"). אם מוצגת בחירת סוג אפליקציה: **Business**.
3. **שם:** `Elements CRM`.
4. **Business portfolio:** לבחור את העסק של Elements מהשלב המקדים, **לא** "I don't want to connect a business portfolio yet". חיבור לעסק הנכון עכשיו חוסך העברה מאוחר יותר.
5. **Create app.**

## שלב 3 · מספר הבדיקה
1. באפליקציה: **WhatsApp → API Setup** (נקרא גם Getting Started).
2. Meta יוצרת אוטומטית **מספר בדיקה** ו-**WhatsApp Business Account** לבדיקה.
3. **לשמור בצד שני מזהים** (הם לא סודיים, ואפשר לשלוח לי אותם בצ'אט):
   - `Phone number ID`
   - `WhatsApp Business Account ID`
4. **To → Manage phone number list → Add:** את הטלפון שלך. מגיע קוד ב-WhatsApp, ומזינים אותו. אפשר להוסיף עוד כמה טלפונים של הצוות.
5. **Send message:** Meta שולחת את התבנית המובנית `hello_world` לטלפון שלך. אם היא הגיעה, החיבור עובד.

**מה לא לעשות כאן:** "Add phone number" עם מספר אמיתי. זה שלב מאוחר, והוא דורש את ההחלטה על 051-525-5387.

## שלב 4 · טוקן קבוע
הטוקן שמופיע ב-API Setup **זמני** ופג תוך כ-24 שעות. לבדיקות ממושכות צריך טוקן קבוע:

1. **business.facebook.com → Settings → Users → System users → Add.**
2. **שם:** `elements-crm-dev`. **תפקיד:** Admin.
3. **Assign assets:**
   - Apps → `Elements CRM` → Full control.
   - WhatsApp accounts → חשבון הבדיקה → Full control.
4. **Generate new token** → האפליקציה `Elements CRM` → **תוקף:** Never (אם מוצגת בחירה).
5. **הרשאות:**
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - `business_management` (אם מבוקשת)
6. **להעתיק את הטוקן פעם אחת** למנהל סיסמאות. Meta לא מציגה אותו שוב.

**איפה הטוקן לא צריך להיות:** בצ'אט איתי, במייל, בקובץ בריפו, או בטבלת "הגדרות" ב-Airtable. כשנגיע לשלב הבדיקה ב-DEV, תכניס/י אותו בעצמך כ-secret בשם `WHATSAPP_TOKEN` באוטומציה Message Sending, באותו מקום שבו מוגדר secret ל-AI.

## שלב 5 · App Secret (לקולט ההודעות, בהמשך)
**App settings → Basic → App secret.** זה סוד: הוא משמש לבדיקת החתימה של הודעות נכנסות. **לא להעתיק עכשיו.** הוא ייכנס ישירות למתווך כשנבנה אותו.

## מה תקבל/י בסוף
- ✅ אפליקציה `Elements CRM`, משויכת לעסק של Elements.
- ✅ מספר בדיקה, ו-`hello_world` שהגיע לטלפון שלך.
- ✅ `Phone number ID` + `WhatsApp Business Account ID` → אליי.
- ✅ טוקן קבוע במנהל סיסמאות → לא אליי.

## מה בא אחר כך (לא עכשיו)
| שלב | מה | למה מחכים |
|---|---|---|
| בדיקה ב-DEV | שליחה אמיתית ממספר הבדיקה ללידי TEST עם הטלפון שלך | הקוד של השולח + שדות חדשים ב-DEV (plan שלבים 2–4) |
| אימות עסק, תשלום, שם תצוגה | מבעל העסק | לפני שליחה ללקוחות |
| התבניות שלנו | הגשה מ-`templates-meta.md` | אפשר להגיש כבר על חשבון הבדיקה כדי לראות אם Meta מאשרת את הנוסח. התבניות שייכות ל-WABA, ולכן אם המספר האמיתי ייכנס ל-WABA אחר, נגיש שוב |
| המספר האמיתי | החלטה: Coexistence דרך ספק BSP, או מספר חדש ייעודי | plan סעיף 5.1 |
