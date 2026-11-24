# EventTicketing.Client

ממשק משתמש למערכת ניהול אירועים והזמנת מקומות ישיבה.

## Technologies

- HTML5
- CSS3
- JavaScript ES Modules
- Fetch API
- JWT Authentication
- REST API

## Features

### Public

- צפייה באירועים פעילים ועתידיים.
- חיפוש אירועים ומיון.
- חלוקה לעמודים.
- צפייה בפרטי אירוע ובמפת מקומות הישיבה.
- הרשמה והתחברות למערכת.

### User

- בחירת מקום ישיבה פנוי.
- ביצוע הזמנה.
- צפייה בהיסטוריית ההזמנות.
- ביטול הזמנה בהתאם לכללי המערכת.

### Admin

- ניהול אירועים ואולמות.
- יצירה ועדכון של אירועים.
- ביטול ושחזור אירועים.
- שמירה ושחרור של מקומות ישיבה.
- חיפוש, סינון ומיון אירועים.

## Project Structure

```
EventTicketing.Client/
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
├── js/
│   ├── admin.js
│   ├── api.js
│   ├── auth.js
│   ├── auth-page.js
│   ├── bookings.js
│   ├── config.js
│   ├── event.js
│   ├── events.js
│   ├── layout.js
│   ├── seat-map.js
│   └── utils.js
├── admin.html
├── bookings.html
├── event.html
├── index.html
├── login.html
├── register.html
├── .gitignore
└── README.md
```

## Architecture

הקוד מחולק למודולים בעלי אחריות מוגדרת:

- config.js – הגדרות המערכת וכתובות API.
- api.js – תקשורת מרכזית עם השרת.
- auth.js – ניהול התחברות והרשאות בממשק.
- layout.js – רכיבי ממשק משותפים.
- seat-map.js – רכיב מפת מקומות ישיבה.
- utils.js – פונקציות עזר משותפות.
- Page modules – ניהול ההתנהגות של עמודי המערכת.

## Backend

צד השרת מבוסס על ASP.NET Core Web API ו-.NET 10.

Server repository:

https://github.com/s0534126922-ai/EventTicketing

## Local Setup

### 1. Start the backend

יש להגדיר ולהפעיל את צד השרת בהתאם להוראות ה-README במאגר השרת.

כתובת ה-API המקומית:

http://localhost:5066/api

### 2. Start the frontend

מתוך תיקיית הפרויקט, כאשר Python מותקן:

```powershell
py -m http.server 5500 --bind 127.0.0.1
```

### 3. Open the application

http://127.0.0.1:5500

אין לפתוח את קובצי ה-HTML ישירות באמצעות file://.

## Authentication and Security

- התחברות באמצעות JWT.
- שמירת נתוני ההתחברות ב-sessionStorage.
- שליחת Authorization Header בבקשות מאומתות.
- הפרדה בין ממשק משתמש לממשק מנהל.
- אימות הרשאות וכללים עסקיים בצד השרת.
- טיפול בתגובות שגיאה ובהתנגשויות HTTP 409.
- אין לשמור סיסמאות או מפתחות סודיים בקוד הלקוח.

## Testing

בוצעו בהצלחה 30 בדיקות ממשק ידניות:

- 14 בדיקות ממשק משתמש.
- 16 בדיקות ממשק מנהל.

בנוסף, בפרויקט השרת עברו בהצלחה 59 בדיקות אוטומטיות.

## Deployment Plan

- Frontend: Render Static Site.
- Backend: Render Web Service with Docker.
- Database: Neon PostgreSQL.

כתובות סביבת הייצור יעודכנו לאחר השלמת הפריסה בענן.