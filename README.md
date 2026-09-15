# Какво ще правим тая вечер? — жива версия (Supabase + Vercel)

Това е истинският, хостван вариант на приложението — чете данните на живо от
Supabase вместо от твърдо закодирани масиви. Когато GitHub ботът добави ново
събитие в базата, то ще се появи тук само след презареждане на страницата —
без някой да пипа кода отново.

## Стъпка 1 — разшири Supabase схемата (само веднъж)

В Supabase → SQL Editor → paste съдържанието на `supabase-schema-extend.sql`
(файлът е извън тази папка, дадох ти го в чата) → Run. Добавя няколко нови
колони, които живата версия ползва (facebook, sub_genre и др.).

## Стъпка 2 — вземи anon ключа (НЕ service_role!)

1. Supabase → Project Settings → API Keys
2. Копирай **anon** / **publishable** ключа (не secret/service_role — той е
   само за GitHub бота, никога не влиза в frontend код)

## Стъпка 3 — качи тази папка в нов GitHub repo

Същия начин както при бота:
1. github.com → New repository → име напр. `kvecher-app` → Public е ОК този
   път (тук няма тайни в кода — ключът се задава отделно през Vercel, не се
   качва във файловете)
2. "uploading an existing file" → качваш цялата папка `app-project`

## Стъпка 4 — деплой във Vercel (безплатно)

1. **vercel.com** → Sign up / Log in **with GitHub** (най-лесно)
2. **Add New → Project**
3. Избираш repo-то `kvecher-app`
4. Vercel обикновено разпознава автоматично, че е Vite проект — ако не,
   Framework Preset: **Vite**
5. Преди да натиснеш Deploy, отваряш **Environment Variables** и добавяш:
   - `VITE_SUPABASE_URL` = твоят Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon ключа от Стъпка 2
6. **Deploy**

След ~1 минута получаваш истински линк (нещо като
`kvecher-app.vercel.app`) — това е реалният сайт, който можеш да пращаш на
хора. Всеки път, когато GitHub ботът добави ново събитие в Supabase, то ще
се появява тук автоматично — не трябва нищо да преqkачваш.

## Локално тестване (по желание, ако имаш компютър с Node.js)

```
npm install
cp .env.example .env   # после попълваш истинските стойности в .env
npm run dev
```

## Ако нещо не зареди данни

Отвори сайта → ако виждаш "Зареждане на живи данни..." заседнало завинаги
или червена грешка — най-честата причина е грешен `VITE_SUPABASE_ANON_KEY`
(объркан с service_role) или RLS policy-тата не са пуснати (виж
`supabase-schema.sql` от началото — редовете с `create policy "public
read..."`).
